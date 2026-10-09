import { Link } from "wouter";

import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
import { ProfileMenu } from "../auth/ProfileMenu";
import { HOME } from "../routes";
import { spriteUrl } from "../sprites";
import { LanguageMenu } from "./LanguageMenu";
import { NavTabs } from "./NavTabs";

const SNORLAX_DEX = 143;

/** The sticky top menu: brand, the tools, and the account (design-system §5, App bar). */
export function AppBar() {
  const { status } = useAuth();
  return (
    <div className="appbar">
      <div className="appbar__inner">
        <Link href={HOME} className="brand">
          <img src={spriteUrl(SNORLAX_DEX)} alt="" width={30} height={30} />
          <span className="brand__name">sleepmon</span>
        </Link>
        <NavTabs />
        <div className="appbar__right">
          {status === "checking" ? (
            <div className="auth-slot-placeholder" aria-hidden="true" />
          ) : status === "authenticated" ? (
            <ProfileMenu />
          ) : (
            <>
              <GoogleSignInButton reason="app_bar" />
              <LanguageMenu />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
