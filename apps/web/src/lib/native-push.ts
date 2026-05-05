import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import {
  PushNotifications,
  type PushNotificationToken,
  type Token,
} from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase";

let listenersInstalled = false;
let latestUserId: string | null = null;
let lastRegisteredTokenKey: string | null = null;

async function upsertPushToken(userId: string, token: string) {
  const platform = Capacitor.getPlatform();
  if (platform !== "ios" && platform !== "android") return;

  const { identifier } = await Device.getId();
  const tokenKey = `${userId}:${platform}:${token}`;
  if (tokenKey === lastRegisteredTokenKey) return;

  const { error } = await supabase.rpc("register_push_token", {
    p_token: token,
    p_platform: platform,
    p_provider: "fcm",
    p_device_id: identifier,
  });
  if (error) throw error;

  lastRegisteredTokenKey = tokenKey;
}

async function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  await PushNotifications.addListener(
    "registration",
    (token: Token | PushNotificationToken) => {
      if (!latestUserId) return;
      const value = token.value;
      void upsertPushToken(latestUserId, value).catch((error: unknown) => {
        console.error("Failed to register push token", error);
      });
    },
  );

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("Native push registration failed", error);
  });
}

export async function enableNativePushIfEligible(userId: string | null) {
  latestUserId = userId;
  if (!userId) return;
  if (!Capacitor.isNativePlatform()) return;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("notification_push_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.notification_push_enabled) return;

  await installListeners();

  const permissionStatus = await PushNotifications.checkPermissions();
  if (permissionStatus.receive !== "granted") {
    const requested = await PushNotifications.requestPermissions();
    if (requested.receive !== "granted") return;
  }

  await PushNotifications.register();
}
