const express = require("express");
const axios = require("axios");

const router = express.Router();

// Get location from lat/lon
router.get("/reverse-geocode", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat & lon required" });
  }

  try {
    // ✅ Primary: Ola Maps Reverse Geocoding
    const olaRes = await axios.get(
      "https://api.olamaps.io/places/v1/reverse-geocode",
      {
        params: { lat, lon, api_key: process.env.OLA_API_KEY },
      }
    );

    if (olaRes.data && olaRes.data.address) {
      return res.json({
        provider: "ola",
        address: olaRes.data.address,
        raw: olaRes.data,
      });
    }

    throw new Error("Ola failed");
  } catch (err) {
    console.warn("Ola Maps failed, using OSM...");

    // ✅ Fallback: OpenStreetMap Nominatim
    try {
      const osmRes = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
          params: { lat, lon, format: "json" },
        }
      );

      return res.json({
        provider: "osm",
        address: osmRes.data.display_name,
        raw: osmRes.data,
      });
    } catch (osmErr) {
      console.error("OSM error:", osmErr.message);
      return res.status(500).json({ error: "location_service_failed" });
    }
  }
});

module.exports = router;
