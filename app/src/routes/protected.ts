import { Router } from "express";

const router = Router();

router.get("/protected", (req, res) => {
    const user = (req.session as any).user;
    const authType = (req.session as any).authType;

    if (!user) {
        res.redirect("/");
        return;
    }

    res.render("protected", {
        user,
        authType,
    });
});

export default router;