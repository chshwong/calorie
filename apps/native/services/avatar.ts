import { prepareAvatarImageAsync } from "@/lib/images/avatar";
import { uploadAvatarAsync } from "@/lib/storage/avatars";
import { getAvatarUrl } from "@/lib/storage/getAvatarUrl";

export async function uploadAvatar(params: { userId: string; localUri: string }) {
  const { userId, localUri } = params;

  const { uri: resizedUri } = await prepareAvatarImageAsync(localUri);
  const { path } = await uploadAvatarAsync({ userId, localUri: resizedUri });
  const publicUrl = getAvatarUrl(path);
  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

  return { publicUrl, cacheBustedUrl, storagePath: path };
}
