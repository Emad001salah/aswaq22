import React, { createContext, useContext, useState, useEffect } from 'react';
import { Market, MARKETS } from '../markets.ts';

interface MarketContextType {
  market: Market;
  setMarket: (market: Market) => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [market, setMarket] = useState<Market>(() => {
    try {
      const saved = localStorage.getItem('selected_market_id');
      if (saved && MARKETS[saved]) return MARKETS[saved];
    } catch (e) {}
    return MARKETS.YE;
  });
  
  const handleSetMarket = (newMarket: Market) => {
    try {
      if (newMarket?.id) {
        localStorage.setItem('selected_market_id', newMarket.id);
        localStorage.setItem('user_manually_selected_market', 'true');
      }
    } catch (e) {}
    setMarket(newMarket);
  };

  useEffect(() => {
    if (market?.id) {
      localStorage.setItem('selected_market_id', market.id);
    }
  }, [market]);

  useEffect(() => {
    const detectMarket = async () => {
      // Only auto-detect if nothing is saved in localStorage
      if (localStorage.getItem('selected_market_id')) return;
      try {
        let countryCode = null;
        let cData: any = null;
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          if (data && data.country_code) {
             countryCode = data.country_code;
             cData = data;
          }
        } catch (ipapiError) {
          const fallbackRes = await fetch("https://api.country.is/");
          const fallbackData = await fallbackRes.json();
          if (fallbackData && fallbackData.country) {
             countryCode = fallbackData.country;
          }
        }
        
        if (countryCode) {
           if (MARKETS[countryCode]) {
              setMarket(MARKETS[countryCode]);
           } else {
              // Dynamic generation logic
              const arName = new Intl.DisplayNames(['ar'], { type: 'region' }).of(countryCode) || countryCode;
              const enName = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
              
              const dynamicCities: any[] = [];
              const dynamicCoords: any = {};
              
              if (cData && cData.city) {
                 dynamicCities.push({ id: cData.city.toLowerCase(), nameAr: cData.city, nameEn: cData.city });
                 dynamicCoords[cData.city.toLowerCase()] = { lat: cData.latitude || 24, lng: cData.longitude || 45, ar: cData.city };
              } else {
                 dynamicCities.push({ id: 'all_regions', nameAr: 'كل المناطق', nameEn: 'All Regions' });
                 dynamicCoords['all_regions'] = { lat: 24, lng: 45, ar: 'كل المناطق' };
              }

              const newMarket: Market = {
                id: countryCode,
                countryCode: countryCode,
                labelAr: arName,
                labelEn: enName,
                center: { lat: cData?.latitude || 24, lng: cData?.longitude || 45 },
                currency: cData?.currency || 'USD',
                deliveryTermAr: 'خدمة التوصيل',
                deliveryTermEn: 'Delivery Service',
                shippingInfoAr: 'توصيل عبر شركاء المنصة.',
                shippingInfoEn: 'Delivery via platform partners.',
                cities: dynamicCities,
                cityCoordinates: dynamicCoords,
                usdRate: 1
              };
              
              MARKETS[countryCode] = newMarket; 
              setMarket(newMarket);
           }
        }
      } catch (e) {
        console.log("Market detection failed, defaulting", e);
      }
    };
    detectMarket();
  }, []);

  return (
    <MarketContext.Provider value={{ market, setMarket: handleSetMarket }}>
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
};
