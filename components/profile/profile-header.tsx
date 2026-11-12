import { User } from "lucide-react";
import { EditProfileSheet } from "@/components/profile/edit-profile-sheet";
import { getInitials } from "@/lib/profile/utils";
import { avatarPublicUrl } from "@/lib/storage/avatar-url";

interface ProfileHeaderProps {
  userId: string;
  nickname: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Identità: avatar con iniziali (decorativo, il nome è già testo),
 * nickname o stato vuoto, email attenuata, unica CTA primaria della pagina.
 */
export function ProfileHeader({ userId, nickname, email, avatarUrl }: ProfileHeaderProps) {
  const hasNickname = nickname !== null && nickname.trim() !== "";
  const publicAvatarUrl = avatarPublicUrl(avatarUrl);

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2">
      {publicAvatarUrl ? (
        <img
          src={publicAvatarUrl}
          alt=""
          width={72}
          height={72}
          className="w-[72px] h-[72px] rounded-chip border border-[var(--accent)] object-cover"
        />
      ) : hasNickname ? (
        <div
          aria-hidden="true"
          className="flex items-center justify-center w-[72px] h-[72px] rounded-chip border border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-display text-2xl font-bold"
        >
          {getInitials(nickname)}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="flex items-center justify-center w-[72px] h-[72px] rounded-chip border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
        >
          <User className="w-7 h-7" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold leading-tight break-words">
          {hasNickname ? nickname : "Nessun nickname"}
        </p>
        {email && (
          <p className="mt-1 text-sm text-[var(--text-muted)] truncate">
            {email}
          </p>
        )}
        {!hasNickname && (
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--text-secondary)]">
            Scegli come ti vedono gli altri in lobby.
          </p>
        )}
      </div>
      <div className="col-span-full mt-1">
        <EditProfileSheet
          userId={userId}
          currentNickname={nickname}
          currentAvatarUrl={avatarUrl}
          mode={hasNickname ? "edit" : "create"}
        />
      </div>
    </div>
  );
}
