import { useEffect } from "react";
import { useRouter } from "next/router";
import Loading from "@/Components/UI/Loading";

// Profile has been consolidated into Settings — the "Profile & Security"
// section lives at /settings?section=profile. Keep this route as a permanent
// client-side redirect so existing links/bookmarks continue to work.
const Profile = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings?section=profile");
  }, [router]);

  return <Loading />;
};

export default Profile;
