import { Router } from "express";
import passport from "passport";
import { samlStrategy } from "../auth/saml";

const router = Router();

router.get(
    "/auth/saml",
    passport.authenticate("saml", {
        failureRedirect: "/",
    })
);

router.post(
    "/auth/saml/callback",
    passport.authenticate("saml", {
        failureRedirect: "/",
    }),
    (req, res) => {
        const samlUser = req.user as any;

        (req.session as any).user =
            samlUser?.email || samlUser?.nameId || samlUser?.id || "unknown_saml_user";

        (req.session as any).authType = "SAML";
        (req.session as any).samlNameId = samlUser?.nameId;
        (req.session as any).samlSessionIndex = samlUser?.sessionIndex;

        res.redirect("/protected");
    }
);

router.get("/logout/saml", (req, res, next) => {
    (samlStrategy as any).logout(req, (error: Error | null, logoutUrl?: string) => {
        if (error) {
            next(error);
            return;
        }

        req.session.destroy(() => {
            res.redirect(logoutUrl || "/");
        });
    });
});

router.post("/logout/saml/callback", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

export default router;