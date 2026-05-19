import session, { type SessionData } from "express-session";
import { type Collection, type Db, type MongoClient } from "mongodb";
import { type Connection } from "mongoose";

const DEFAULT_COLLECTION_NAME = "session";
const DEFAULT_TTL_SECONDS = 1_209_600;

type StoreCallback<T = void> = T extends void
    ? (error?: unknown) => void
    : (error: unknown, value?: T) => void;

type SessionValueCallback = (error: unknown, value?: SessionData | null) => void;

type SessionListCallback = (
    error: unknown,
    value?: { [sid: string]: SessionData } | null
) => void;

type OperationCallback<T> = (error: unknown, value?: T) => void;

type CleanupTimer = ReturnType<typeof setInterval>;

interface DeleteResultLike {
    readonly deletedCount?: number;
}

interface SessionCursor {
    toArray(): Promise<StoredSessionDocument[]>;
}

interface SessionCollection {
    createIndex(indexSpec: { expiresAt: 1 }, options: { expireAfterSeconds: 0 }): Promise<string>;
    findOne(filter: Record<string, unknown>): Promise<StoredSessionDocument | null>;
    updateOne(
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options?: { upsert?: boolean }
    ): Promise<unknown>;
    deleteOne(filter: Record<string, unknown>): Promise<DeleteResultLike>;
    deleteMany(filter: Record<string, unknown>): Promise<DeleteResultLike>;
    find(filter: Record<string, unknown>): SessionCursor;
    countDocuments(filter: Record<string, unknown>): Promise<number>;
}

export interface StoredSessionDocument {
    _id: string;
    session: SessionData;
    expiresAt: Date;
    updatedAt: Date;
}

export interface BaseSessionStoreOptions {
    collectionName?: string;
    collection?: string;
    ttlSeconds?: number;
    clearIntervalSeconds?: number;
    clear_interval?: number;
    autoCreateTtlIndex?: boolean;
}

export type MongoDriverSessionStoreOptions = BaseSessionStoreOptions & (
    | {
        client: MongoClient;
        dbName: string;
        db?: never;
    }
    | {
        db: Db;
        client?: never;
        dbName?: never;
    }
);

export interface MongooseSessionStoreOptions extends BaseSessionStoreOptions {
    connection: Connection;
}

interface NormalizedOptions {
    collectionName: string;
    ttlSeconds: number;
    clearIntervalSeconds: number;
    autoCreateTtlIndex: boolean;
}

function normalizeOptions(options: BaseSessionStoreOptions): NormalizedOptions {
    return {
        collectionName: options.collectionName ?? options.collection ?? DEFAULT_COLLECTION_NAME,
        ttlSeconds: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
        clearIntervalSeconds: options.clearIntervalSeconds ?? options.clear_interval ?? 0,
        autoCreateTtlIndex: options.autoCreateTtlIndex !== false
    };
}

function asSessionCollection(collection: unknown): SessionCollection {
    return collection as SessionCollection;
}

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function resolveExpiresAt(sessionData: SessionData, ttlSeconds: number): Date {
    const expires = sessionData.cookie.expires;

    if (isValidDate(expires)) {
        return expires;
    }

    return new Date(Date.now() + ttlSeconds * 1000);
}

function activeFilter(now = new Date()): Record<string, unknown> {
    return { expiresAt: { $gt: now } };
}

function expiredFilter(now = new Date()): Record<string, unknown> {
    return { expiresAt: { $lte: now } };
}

abstract class CollectionBackedSessionStore extends session.Store {
    private readonly collection: SessionCollection;
    private readonly ttlSeconds: number;
    private readonly autoCreateTtlIndex: boolean;
    private ready: Promise<void> | undefined;
    private cleanupTimer: CleanupTimer | undefined;

    protected constructor(collection: SessionCollection, options: BaseSessionStoreOptions) {
        super();

        const normalized = normalizeOptions(options);
        this.collection = collection;
        this.ttlSeconds = normalized.ttlSeconds;
        this.autoCreateTtlIndex = normalized.autoCreateTtlIndex;

        if (normalized.clearIntervalSeconds > 0) {
            this.cleanupTimer = setInterval(() => {
                void this._cleanupExpiredSessions().catch((error: unknown) => {
                    this.emit("error", error);
                });
            }, normalized.clearIntervalSeconds * 1000);
            this.cleanupTimer.unref?.();
        }
    }

    get(sid: string, callback: SessionValueCallback): void {
        void this.run(callback, async () => {
            const document = await this.collection.findOne({ _id: sid });

            if (!document) {
                return null;
            }

            if (document.expiresAt <= new Date()) {
                await this.collection.deleteOne({ _id: sid });
                return null;
            }

            return document.session;
        });
    }

    set(sid: string, sessionData: SessionData, callback?: StoreCallback): void {
        void this.run(callback, async () => {
            const now = new Date();
            await this.collection.updateOne(
                { _id: sid },
                {
                    $set: {
                        session: sessionData,
                        expiresAt: resolveExpiresAt(sessionData, this.ttlSeconds),
                        updatedAt: now
                    }
                },
                { upsert: true }
            );
        });
    }

    destroy(sid: string, callback?: StoreCallback): void {
        void this.run(callback, async () => {
            await this.collection.deleteOne({ _id: sid });
        });
    }

    touch(sid: string, sessionData: SessionData, callback?: StoreCallback): void {
        void this.run(callback, async () => {
            await this.collection.updateOne(
                { _id: sid },
                {
                    $set: {
                        "session.cookie": sessionData.cookie,
                        expiresAt: resolveExpiresAt(sessionData, this.ttlSeconds),
                        updatedAt: new Date()
                    }
                }
            );
        });
    }

    all(callback: SessionListCallback): void {
        void this.run(callback, async () => {
            const documents = await this.collection.find(activeFilter()).toArray();
            return documents.reduce<{ [sid: string]: SessionData }>((sessions, document) => {
                sessions[document._id] = document.session;
                return sessions;
            }, {});
        });
    }

    length(callback: StoreCallback<number>): void {
        void this.run(callback, async () => this.collection.countDocuments(activeFilter()));
    }

    clear(callback?: StoreCallback): void {
        void this.run(callback, async () => {
            await this.collection.deleteMany({});
        });
    }

    private async _cleanupExpiredSessions(): Promise<number> {
        await this.ensureReady();
        const result = await this.collection.deleteMany(expiredFilter());
        return result.deletedCount ?? 0;
    }

    private stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }

    private async run<T>(callback: OperationCallback<T> | undefined, operation: () => Promise<T>): Promise<void> {
        let value: T;

        try {
            await this.ensureReady();
            value = await operation();
        } catch (error: unknown) {
            callback?.(error);
            return;
        }

        callback?.(null, value);
    }

    private async ensureReady(): Promise<void> {
        if (!this.autoCreateTtlIndex) {
            return;
        }

        this.ready ??= this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
            .then(() => undefined)
            .catch((error: unknown) => {
                this.ready = undefined;
                throw error;
            });
        await this.ready;
    }
}

export class MongoSessionStore extends CollectionBackedSessionStore {
    constructor(options: MongoDriverSessionStoreOptions) {
        const normalized = normalizeOptions(options);
        const db = "db" in options ? options.db : options.client.db(options.dbName);
        const collection: Collection<StoredSessionDocument> = db.collection<StoredSessionDocument>(normalized.collectionName);
        super(asSessionCollection(collection), options);
    }
}

export class MongooseSessionStore extends CollectionBackedSessionStore {
    constructor(options: MongooseSessionStoreOptions) {
        const normalized = normalizeOptions(options);
        const collection = options.connection.collection<StoredSessionDocument>(normalized.collectionName);
        super(asSessionCollection(collection), options);
    }
}

export function createMongoSessionStore(options: MongoDriverSessionStoreOptions): MongoSessionStore {
    return new MongoSessionStore(options);
}

export function createMongooseSessionStore(options: MongooseSessionStoreOptions): MongooseSessionStore {
    return new MongooseSessionStore(options);
}

export default MongoSessionStore;
