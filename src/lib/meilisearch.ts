import { Meilisearch, Index } from 'meilisearch';

let meiliClient: Meilisearch | null = null;
let isMeiliAvailable = false;
let adsIndex: Index | null = null;

const meiliHost = process.env.MEILI_HOST || 'http://localhost:7700';
const meiliKey = process.env.MEILI_API_KEY || 'masterKey';

try {
  console.log(`[Meilisearch] Initializing client pointing to ${meiliHost}...`);
  meiliClient = new Meilisearch({
    host: meiliHost,
    apiKey: meiliKey,
  });

  // Verify connection by checking key/health
  meiliClient.health()
    .then(async () => {
      isMeiliAvailable = true;
      adsIndex = meiliClient!.index('ads');
      console.log('\x1b[32m[Meilisearch] Connected and healthy.\x1b[0m');
      
      // Update filters and sortable fields
      await adsIndex.updateFilterableAttributes(['city', 'category', 'status', 'price', 'condition']);
      await adsIndex.updateSortableAttributes(['price', 'createdAt']);
    })
    .catch((err) => {
      isMeiliAvailable = false;
      console.warn('\x1b[33m[Meilisearch] Warning: Server unreachable. Fuzzy search disabled. Falling back to DB search.\x1b[0m');
    });
} catch (e) {
  console.warn('[Meilisearch] Failed to initialize MeiliSearch client:', e);
}

export const searchEngine = {
  isAvailable(): boolean {
    return isMeiliAvailable;
  },

  async indexAd(ad: {
    id: string;
    title: string;
    description: string;
    city: string;
    price: number;
    category: string;
    status: string;
  }): Promise<void> {
    if (!isMeiliAvailable || !adsIndex) return;
    try {
      await adsIndex.addDocuments([
        {
          id: ad.id,
          title: ad.title,
          description: ad.description,
          city: ad.city,
          price: ad.price,
          category: ad.category,
          status: ad.status,
        },
      ]);
    } catch (e) {
      console.error('[Meilisearch] Error indexing ad:', e);
    }
  },

  async deleteAd(adId: string): Promise<void> {
    if (!isMeiliAvailable || !adsIndex) return;
    try {
      await adsIndex.deleteDocument(adId);
    } catch (e) {
      console.error('[Meilisearch] Error deleting indexed ad:', e);
    }
  },

  async search(
    query: string,
    filters: { city?: string; category?: string; status?: string; minPrice?: number; maxPrice?: number } = {},
    limit = 20
  ): Promise<any[] | null> {
    if (!isMeiliAvailable || !adsIndex) return null; // Let caller fallback to db
    try {
      const filterQueries: string[] = [];
      if (filters.status) filterQueries.push(`status = "${filters.status}"`);
      if (filters.city) filterQueries.push(`city = "${filters.city}"`);
      if (filters.category) filterQueries.push(`category = "${filters.category}"`);
      if (filters.minPrice !== undefined) filterQueries.push(`price >= ${filters.minPrice}`);
      if (filters.maxPrice !== undefined) filterQueries.push(`price <= ${filters.maxPrice}`);

      const result = await adsIndex.search(query, {
        limit,
        filter: filterQueries.join(' AND '),
      });
      return result.hits;
    } catch (e) {
      console.error('[Meilisearch] Search request failed:', e);
      return null;
    }
  }
};
