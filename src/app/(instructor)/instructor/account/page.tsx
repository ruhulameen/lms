import type { Metadata } from "next";
import AccountPage from "@/app/(admin)/admin/account/page";

export const metadata: Metadata = { title: "Account" };

// The same profile, password and two-factor sections as the admin account page.
export default AccountPage;
