import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Geolocation } from '@capacitor/geolocation';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Checks if the application is running inside a Capacitor native container.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Native-supported status bar helper
 */
export const setNativeStatusBar = async (isDark: boolean) => {
  if (isNativePlatform()) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light,
      });
      await StatusBar.setBackgroundColor({
        color: isDark ? '#090d16' : '#ffffff',
      });
    } catch (e) {
      console.warn('[Native Bridge] StatusBar API not supported:', e);
    }
  }
};

/**
 * Open native share sheet or fallback to web sharing API
 */
export const shareContent = async (options: { title: string; text: string; url?: string }) => {
  if (isNativePlatform()) {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: options.title,
          text: options.text,
          url: options.url || window.location.href,
          dialogTitle: options.title,
        });
        return true;
      }
    } catch (e) {
      console.warn('[Native Bridge] Capacitor Native Share failed, falling back to Web API:', e);
    }
  }

  // Fallback to standard Navigator Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url || window.location.href,
      });
      return true;
    } catch (e) {
      console.error('[Web Bridge] Web Share API failed or dismissed:', e);
    }
  }

  // Fallback to manual clipboard copy
  try {
    const shareUrl = options.url || window.location.href;
    await navigator.clipboard.writeText(`${options.title}: ${options.text} - ${shareUrl}`);
    return 'copied';
  } catch (err) {
    console.error('[Web Bridge] Clipboard write failed:', err);
    return false;
  }
};

/**
 * Request location coordinate precision utilizing native sensory GPS or standard browser API
 */
export const getDeviceLocation = async () => {
  if (isNativePlatform()) {
    try {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          throw new Error('Location permission denied natively');
        }
      }
      
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } catch (e) {
      console.warn('[Native Bridge] GPS locator failed, falling back to Web Geolocation:', e);
    }
  }

  // Fallback to standard Browser Geolocation API
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { 
        enableHighAccuracy: true, 
        timeout: 15000,
        maximumAge: 0 
      }
    );
  });
};

/**
 * Open device camera lens to capture high-resolution imagery
 */
export const captureDeviceCamera = async () => {
  if (isNativePlatform()) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });
      return image.webPath || null;
    } catch (e) {
      console.error('[Native Bridge] Camera capture failed:', e);
      return null;
    }
  }
  return null;
};

/**
 * Configure and register push notifications using FCM or Capacitor PushNotification APIs
 */
export const setupPushNotifications = (
  userId: string | null,
  onNotificationReceived: (title: string, body: string, data?: any) => void
) => {
  if (isNativePlatform()) {
    // Import and configure dynamically to handle web compilations safely
    import('@capacitor/push-notifications').then(({ PushNotifications }) => {
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          // Register with mobile OS push registration engine
          console.warn('[Native FCM Bridge] Skipped native registration - google-services.json is missing');
        } else {
          console.warn('[Native FCM Bridge] Push notification permission denied natively');
        }
      });

      // Retrieve device registration token to register it inside deep Firebase/local database
      PushNotifications.addListener('registration', (token) => {
        console.log('[Native FCM Bridge] Registration token obtained:', token.value);
        localStorage.setItem('aswaq_fcm_token', token.value);
        
        // Report device token to the server database
        fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token.value,
            platform: Capacitor.getPlatform(),
            userId: userId || null
          })
        }).catch(err => console.error('[Native FCM Bridge] Failed to register token on server:', err));
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Native FCM Bridge] Registration error occurred:', error);
      });

      // Handle receiving notification while application is in active state (foreground)
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Native FCM Bridge] Foreground notification received:', notification);
        onNotificationReceived(
          notification.title || 'أشواق',
          notification.body || '',
          notification.data
        );
      });

      // Handle custom callback when user interacts/clicks on a push notification banner
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Native FCM Bridge] Notification clicked action:', action);
      });
    }).catch(err => {
      console.error('[Native FCM Bridge] Failed to load Capacitor Push Notification plugin:', err);
    });
  } else {
    // Standard web app fallback for notification request permissions
    // Only register if a user is logged in (avoids 403 on anonymous requests)
    if (!userId) return;

    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            const localToken = localStorage.getItem('aswaq_web_notif_token') || `web_${Math.random().toString(36).substring(2, 11)}`;
            localStorage.setItem('aswaq_web_notif_token', localToken);

            fetch('/api/notifications/register-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('aswaq_access_token') || ''}`,
              },
              body: JSON.stringify({ token: localToken, platform: 'web', userId }),
            }).catch(() => {}); // Silently ignore registration errors
          }
        });
      } else if (Notification.permission === 'granted') {
        const localToken = localStorage.getItem('aswaq_web_notif_token') || `web_${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem('aswaq_web_notif_token', localToken);

        fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('aswaq_access_token') || ''}`,
          },
          body: JSON.stringify({ token: localToken, platform: 'web', userId }),
        }).catch(() => {}); // Silently ignore registration errors
      }
    }
  }
};

