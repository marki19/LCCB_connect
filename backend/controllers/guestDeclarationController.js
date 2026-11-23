const guestAccessModel = require("../models/guestAccessModel");
const { isSchoolAccount } = require("../services/verificationPolicy");

/**
 * Guest Declaration Controller
 * Allows non-school email accounts to declare guest/outsider intent.
 */

const declare = async (req, res, next) => {
  try {
    const { purpose, affiliation_type, affiliation_name, location } = req.body;
    const email = req.user?.email || req.profile?.email;

    if (isSchoolAccount(email)) {
      return res.status(400).json({
        error: "School accounts verify instead",
        code: "school_account",
      });
    }

    if (req.profile?.role !== "user") {
      return res.status(400).json({
        error: "Account type already set",
        code: "role_already_set",
      });
    }

    const request = await guestAccessModel.createRequest(req.user.id, {
      purpose,
      affiliationType: affiliation_type,
      affiliationName: affiliation_name,
      location,
    });

    return res.status(201).json({
      success: true,
      request_id: request.id,
      status: "pending",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  declare,
};
