import { SuiEvent } from "@mysten/sui/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../db";

type EscrowEvent = EscrowCreated | EscrowCancelled | EscrowSwapped

type EscrowCreated = {
    sender: string;
    recipient: string;
    escrow_id: string;
    key_id: string;
    item_id: string
};

type EscrowSwapped = {
    escrow_id: string;
};

type EscrowCancelled = {
    escrow_id: string;
};

export const handleEscrowObjects = async (events: SuiEvent[], type: string) => {
    const updates: Record<string, Prisma.EscrowCreateInput> = {};

    for (const event of events) {
        if (!event.type.startsWith(type)) throw new Error('Invalid event module origin');
        const data = event.parsedJson as EscrowEvent;

        if (!Object.hasOwn(updates, data.escrow_id)) {
            updates[data.escrow_id] = {
                objectId: data.escrow_id,
            }
        }

        if (event.type.endsWith('::EscrowCancelled')) {
            const data = event.parsedJson as EscrowCancelled
            updates[data.escrow_id].cancelled = true
            continue
        }

        if (event.type.endsWith('::EscrowSwapped')) {
            const data = event.parsedJson as EscrowSwapped
            updates[data.escrow_id].swapped = true
            continue
        }

        const creationData = event.parsedJson as EscrowCreated

        updates[data.escrow_id].sender = creationData.sender
        updates[data.escrow_id].recipient = creationData.recipient
        updates[data.escrow_id].keyId = creationData.key_id
        updates[data.escrow_id].itemId = creationData.item_id
    }

    const promise = Object.values(updates).map((update) => prisma.escrow.upsert({
        where: {
            objectId: update.objectId,
        },
        create: update,
        update,
    }))
    await Promise.all(promise)
}