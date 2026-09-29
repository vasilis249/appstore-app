import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { PersonRow } from "@/components/friends/person-row";
import { friendKeys, mutualFollows } from "@/lib/friends";
import { useAuth } from "@/hooks/use-auth";

/** Pick someone you follow and who follows you back, for a new voice message. */
export function FriendPickerSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const list = useQuery({ queryKey: [...friendKeys.all, "mutual"], queryFn: () => mutualFollows(user!.id), enabled: open && !!user });
  const friends = list.data ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[80vh] max-w-lg rounded-t-[28px] border-0 bg-surface-elevated">
        <DrawerTitle className="pt-4 text-center text-lg font-bold">{t("voice.newMessage")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("voice.newMessage")}</DrawerDescription>
        <ul className="safe-bottom overflow-y-auto px-4 pb-4">
          {friends.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onOpen={() => {
                onOpenChange(false);
                void navigate({ to: "/messages/$userId", params: { userId: p.id } });
              }}
            />
          ))}
          {list.data && !friends.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("voice.noFriends")}</p>
          )}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
