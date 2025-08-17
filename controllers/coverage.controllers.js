import { getCoverage } from "../services/bluebutton.services.js";

export const searchCoverage = async (req, res) => {
  console.log("getCoverage called");

  if (!req.session.bbAccessToken) {
    console.log("No access token found in session:", req.session);
    // return res
    //   .status(401)
    //   .json({ redirect: true, url: "http://localhost:5500/api/auth/login" });
    return res.redirect("http://localhost:5500/api/auth/login/");
  }

  try {
    const coverage = await getCoverage(req.session.bbAccessToken);
    //res.json(coverage);
    return res.json(coverage);
  } catch (err) {
    console.log(err);
  }
};
