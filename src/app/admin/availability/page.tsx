import Availability from "@/components/Availability";
import { todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";
export default function Page() { return <Availability today={todayIST()} />; }
