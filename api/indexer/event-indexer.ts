import { EventId, SuiClient, SuiEvent, SuiEventFilter } from '@mysten/sui/client';

import { CONFIG } from '..config';
import { prisma } from '../db';
import { getClient } from '../sui-utils';
import { handleEscrowObjects } from './escrow-handler';
import { handleLockObjects } from './locked-handler';

type SuiEventsCursor = EventId | null | undefined;

type EventExecutionResult = {
    cursor: SuiEventsCursor;
    hasNextPage: boolean;
};

type EventTracker = {
    type: string;
    filter: SuiEventsCursor;
    callback: (events: SuiEvent[], type: string) => any;
};

const EVENTS_TO_TRACK: EventTracker[] = [
    {
        type: `${CONFIG.SWAP_CONTRACT.packageId}::lock`,
        filter: {
            MoveEventModule: {
                module: 'lock',
                package: CONFIG.SWAP_CONTRACT.packageId,
            },
        },
        callback: handleLockObjects,
    },
    {
        type: `${CONFIG.SWAP_CONTRACT.packageId}::shared`,
        filter: {
            MoveEventModule: {
                module: 'shared',
                package: CONFIG.SWAP_CONTRACT.packageId,
            },
        },
        callback: handleEscrowObjects,
    },
];

const executeEventJob = async (
    client: SuiClient,
    tracker: EventTracker,
    cursor: SuiEventsCursor,
): Promise<EventExecutionResult> => {
    try {
        // get the events from the chain.
        // For this implementation, we are going from start to finish.
        // This will also allow filling in a database from scratch!
        const { data, hasNextPage, nextCursor } = await client.queryEvents({
            query: tracker.filter,
            cursor,
            order: 'ascending',
        });

        await tracker.callback(data, tracker.type)

        if (nextCursor && data.length > 0) {
            await saveLatestCursor(tracker, nextCursor)

            return {
                cursor: nextCursor,
                hasNextPage,
            }
        }
    } catch (e) {
        console.error(e)
    }

    return {
        cursor,
        hasNextPage: false
    }
}

const runEventJob = async (client: SuiClient, tracker: EventTracker, cursor: SuiEventsCursor) => {
    const result = await executeEventJob(client, tracker, cursor)

    setTimeout(
        () => {
            runEventJob(client, tracker, result.cursor)
        },
        result.hasNextPage ? 0 : CONFIG.POLLING_INTERVAL_MS,
    )
}

const getLatestCursor = async (tracker: EventTracker) => {
    const cursor = await prisma.cursor.findUnique({
        where: {
            id: tracker.type,
        },
    })

    return cursor || undefined
}

const saveLatestCursor = async (tracker: EventTracker, cursor: EventId) => {
    const data = {
        eventSeq: cursor.eventSeq,
        txDigest: cursor.txDigest,
    }

    return prisma.cursor.upsert({
        where: {
            id: tracker.type,
        },
        update: data,
        create: { id: tracker.type, ...data },
    })
}

export const setupListeners = async () => {
    for (const event of EVENTS_TO_TRACK) {
        runEventJob(getClient(CONFIG.NETWORK),  event, await getLatestCursor(event))
    }
}
}