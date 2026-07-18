export function safeJson(obj: any): string {
  const jsonString = JSON.stringify(obj);
  // Prevent XSS by escaping tag constructs
  return jsonString.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function getWebSiteSchema(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "أسواق",
    "url": "https://www.aswaq22.com/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://www.aswaq22.com/search/{search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };
  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}

export function getOrganizationSchema(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "منصة أسواق",
    "url": "https://www.aswaq22.com/",
    "logo": "https://www.aswaq22.com/uploads/platform-logo.png",
    "sameAs": [
      "https://www.facebook.com/aswaq22",
      "https://www.instagram.com/aswaq22"
    ]
  };
  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}

export function getProductSchema(ad: any, canonicalUrl: string): string {
  const hasPrice = ad.price !== undefined && ad.price !== null && Number(ad.price) > 0;
  
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": ad.title,
    "description": ad.description.substring(0, 300),
    "image": ad.images && ad.images.length > 0
      ? ad.images.map((img: any) => img.url.startsWith('http') ? img.url : `https://www.aswaq22.com${img.url}`)
      : ["https://www.aswaq22.com/aswaq-icon-512.png"]
  };

  if (hasPrice) {
    schema.offers = {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": ad.currency || "YER",
      "price": Number(ad.price),
      "priceValidUntil": new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "itemCondition": "https://schema.org/UsedCondition",
      "availability": "https://schema.org/InStock"
    };
  }

  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}

export function getJobSchema(ad: any, canonicalUrl: string): string {
  const hasPrice = ad.price !== undefined && ad.price !== null && Number(ad.price) > 0;
  const datePosted = ad.createdAt ? new Date(ad.createdAt).toISOString() : new Date().toISOString();
  const validThrough = new Date(new Date(datePosted).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": ad.title,
    "description": ad.description,
    "datePosted": datePosted,
    "validThrough": validThrough,
    "employmentType": ad.jobType === "seeking" ? "PART_TIME" : "FULL_TIME",
    "hiringOrganization": {
      "@type": "Organization",
      "name": ad.ownerName || "معلن في أسواق",
      "sameAs": canonicalUrl
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": ad.city || "صنعاء",
        "addressCountry": "YE"
      }
    }
  };

  if (hasPrice) {
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      "currency": ad.currency || "YER",
      "value": {
        "@type": "QuantitativeValue",
        "value": Number(ad.price),
        "unitText": "MONTH"
      }
    };
  }

  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}

export function getAccommodationSchema(ad: any, canonicalUrl: string): string {
  const hasPrice = ad.price !== undefined && ad.price !== null && Number(ad.price) > 0;
  
  // lands don't fit Accommodation; use Place or Landform
  const isLand = /أرض|اراضي|مخطط|بلك|ارض/i.test(ad.title + " " + ad.description);
  const type = isLand ? "Place" : "Accommodation";

  const schema: any = {
    "@context": "https://schema.org",
    "@type": type,
    "name": ad.title,
    "description": ad.description.substring(0, 300),
    "image": ad.images && ad.images.length > 0
      ? ad.images.map((img: any) => img.url.startsWith('http') ? img.url : `https://www.aswaq22.com${img.url}`)
      : ["https://www.aswaq22.com/aswaq-icon-512.png"],
    "address": {
      "@type": "PostalAddress",
      "addressLocality": ad.city || "صنعاء",
      "addressCountry": "YE"
    }
  };

  if (hasPrice) {
    schema.offers = {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": ad.currency || "YER",
      "price": Number(ad.price),
      "priceValidUntil": new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": "https://schema.org/InStock"
    };
  }

  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}

export function getBreadcrumbSchema(steps: { name: string; url: string }[], canonicalUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": steps.map((step, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": step.name,
      "item": step.url
    }))
  };
  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}

export function getCollectionSchema(ads: any[], title: string, canonicalUrl: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": title,
    "url": canonicalUrl,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": ads.length,
      "itemListElement": ads.map((ad, index) => {
        // Resolve country code from ad
        const countryCode = "ye";
        const categorySlug = ad.category?.nameEn?.toLowerCase() || 'ads';
        
        // slugify helper
        const titleSlug = ad.title
          .toString()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\u0621-\u064A-]+/g, '')
          .replace(/--+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');

        return {
          "@type": "ListItem",
          "position": index + 1,
          "url": `https://www.aswaq22.com/${countryCode}/${categorySlug}/${titleSlug}-${ad.id}`
        };
      })
    }
  };
  return `<script type="application/ld+json">${safeJson(schema)}</script>`;
}
