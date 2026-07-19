import { EventEmitter } from 'events';
import { searchEngine } from './meilisearch.ts';
import { queues } from './queues.ts';

class AppEventEmitter extends EventEmitter {}

export const eventBus = new AppEventEmitter();

// Register listeners dynamically to decouple controller flows
eventBus.on('ad.created', async (ad: any) => {
  console.log(`[Event Bus] ad.created received for ID: ${ad.id}. Triggering indexing and media jobs...`);
  
  // 1. Index in Meilisearch (only if ACTIVE)
  if (ad.status === 'ACTIVE' && searchEngine.isAvailable()) {
    await searchEngine.indexAd({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      city: ad.city,
      price: ad.price,
      category: ad.category,
      status: ad.status,
    });
  }

  // 2. Offload Image resizing and metadata generating to BullMQ
  if (ad.imagesToProcess && ad.imagesToProcess.length > 0) {
    for (const img of ad.imagesToProcess) {
      if (img.mediaId) {
        // Skip legacy processing for enterprise R2 media objects
        continue;
      }
      await queues.addImageJob({
        imageId: img.id,
        imageUrl: img.url,
        outputPath: `ads/${ad.id}/${img.id}.webp`,
      });
    }
  }
});

eventBus.on('ad.updated', async (ad: any) => {
  if (searchEngine.isAvailable()) {
    if (ad.status === 'ACTIVE') {
      await searchEngine.indexAd({
        id: ad.id,
        title: ad.title,
        description: ad.description,
        city: ad.city,
        price: ad.price,
        category: ad.category,
        status: ad.status,
      });
    } else {
      // If status transitioned away from ACTIVE, delete from search index
      await searchEngine.deleteAd(ad.id);
    }
  }
});

eventBus.on('ad.deleted', async (adId: string) => {
  if (searchEngine.isAvailable()) {
    await searchEngine.deleteAd(adId);
  }
});

eventBus.on('message.sent', async (data: { receiverId: string; senderName: string; text: string }) => {
  console.log(`[Event Bus] message.sent received. Enqueuing push notification job...`);
  await queues.addNotificationJob({
    userId: data.receiverId,
    title: `رسالة جديدة من ${data.senderName}`,
    body: data.text,
  });
});
