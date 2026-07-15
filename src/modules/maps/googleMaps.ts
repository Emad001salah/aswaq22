export const loadGoogleMapsScript = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is undefined'));
      return;
    }

    // Check if google maps is already loaded
    if ((window as any).google && (window as any).google.maps) {
      resolve((window as any).google);
      return;
    }

    // Define global auth failure handler
    if (!(window as any).gm_authFailure) {
      (window as any).gm_authFailure = () => {
        console.warn('[GoogleMaps] Authentication failed. Falling back to Mock Maps.');
        (window as any).__googleMapsAuthFailed = true;
        window.dispatchEvent(new CustomEvent('google-maps-auth-failure'));

        // Clean up Google Maps warning overlays from the body
        const cleanup = () => {
          const bodyDivs = document.querySelectorAll('body > div');
          bodyDivs.forEach(div => {
            if (div.id === 'root') return;
            const text = div.textContent || '';
            if (
              text.includes('Google Maps') || 
              text.includes('تملك هذا الموقع') || 
              text.includes('تملك هذا الموقع الإلكتروني') ||
              text.includes('Do you own this website') ||
              text.includes('Oops! Something went wrong') ||
              text.includes('عفواً، حدث خطأ ما') ||
              div.querySelector('.gm-err-container') ||
              div.querySelector('[src*="maps.gstatic.com"]')
            ) {
              console.log('[GoogleMaps] Removing auth warning overlay:', div);
              div.remove();
            }
          });
          const gmErrors = document.querySelectorAll('.gm-err-container, .gm-style-moc');
          gmErrors.forEach(el => el.remove());
        };
        setTimeout(cleanup, 100);
        setTimeout(cleanup, 500);
        setTimeout(cleanup, 1000);
        setTimeout(cleanup, 2000);
      };
    }

    const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      console.warn('[GoogleMaps] API Key is missing. Maps will render in mock/development mode.');
      resolve(null);
      return;
    }

    // Check if script is already injected
    const existingScript = document.getElementById('google-maps-script') as HTMLScriptElement;
    if (existingScript) {
      const currentSrc = existingScript.src || '';
      if (!currentSrc.includes(`key=${apiKey}`)) {
        console.log('[GoogleMaps] API Key changed. Re-injecting Google Maps script...');
        existingScript.remove();
        if ((window as any).google) {
          try {
            delete (window as any).google.maps;
          } catch (e) {}
        }
        (window as any).__googleMapsAuthFailed = false;
      } else {
        const interval = setInterval(() => {
          if ((window as any).google && (window as any).google.maps && !(window as any).__googleMapsAuthFailed) {
            clearInterval(interval);
            resolve((window as any).google);
          }
        }, 100);
        return;
      }
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ar`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve((window as any).google);
    };
    script.onerror = (err) => {
      console.error('[GoogleMaps] Script load error', err);
      reject(err);
    };
    document.head.appendChild(script);
  });
};
