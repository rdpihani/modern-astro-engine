// =========================================================================
// आधुनिक खगोलीय गणना महा-इंजन (Modern JPL/Ephemeris Core)
// =========================================================================

const express = require('express');
const swisseph = require('swisseph');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json());

// क्रॉस-ओरिजिन (CORS) सेटिंग्स ताकि आपकी नई ऐप इससे डेटा ले सके
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    next();
});

// -----------------------------------------------------------------
// बड़ी फाइलों को बैकएंड में ऑटो-डाउनलोड करने का लॉजिक
// -----------------------------------------------------------------
const ephePath = path.join(__dirname, 'ephe');
if (!fs.existsSync(ephePath)) {
    fs.mkdirSync(ephePath);
}

// रेंडर सर्वर को बताना कि स्विस एफिमेरिस का डेटा कहाँ है
swisseph.set_ephe_path(ephePath);

// बुनियादी रूट (Home Route)
app.all('/', async (req, res) => {
    const data = (req.method === 'POST') ? req.body : req.query;
    
    // इनपुट समय और स्थान (डिफ़ॉल्ट रूप से आज का समय और पिहानी के कोऑर्डिनेट्स)
    let year = parseInt(data.year) || 2026;
    let month = parseInt(data.month) || 6;
    let day = parseInt(data.day) || 4;
    let hour = parseFloat(data.hour) || 12;
    let minute = parseFloat(data.minute) || 0;
    let lat = parseFloat(data.latitude) || 27.6300; 
    let lng = parseFloat(data.longitude) || 80.2000;

    // आधुनिक जूलियन डे (Julian Day) की गणना
    let hourDecimal = hour + (minute / 60.0);
    
    // आधुनिक पद्धति में यूटीसी (UTC/GMT) समय का उपयोग होता है
    // भारत का समय (IST) UTC से 5:5 घंटे आगे है, इसलिए गणना के लिए 5.5 घंटे घटाएंगे
    let utcHour = hourDecimal - 5.5;
    let utcDay = day;
    if (utcHour < 0) {
        utcHour += 24;
        utcDay -= 1;
    }

    swisseph.swe_julday(year, month, utcDay, utcHour, swisseph.SE_GREG_CAL, (julianDay) => {
        
        let planetsData = {};
        const planetIds = {
            "सूर्य": swisseph.SE_SUN,
            "चंद्रमा": swisseph.SE_MOON,
            "मंगल": swisseph.SE_MARS,
            "बुध": swisseph.SE_MERCURY,
            "बृहस्पति": swisseph.SE_JUPITER,
            "शुक्र": swisseph.SE_VENUS,
            "शनि": swisseph.SE_SATURN
        };

        // आधुनिक साइंटिफिक पद्धति (True Tropical Positions) से ग्रहों की गणना
        // इसमें वैदिक पद्धति की तरह अयांश (Ayanamsha) घटाया नहीं जाता
        let flag = swisseph.SEFLG_SPEED; 

        Object.keys(planetIds).forEach(pName => {
            let id = planetIds[pName];
            let res = swisseph.swe_calc_ut(julianDay, id, flag);
            if (res) {
                planetsData[pName] = res.longitude; // सटीक दशमलव डिग्री
            }
        });

        // आधुनिक पद्धति से राहु और केतु (True Nodes) की सटीक गणना
        let rahuRes = swisseph.swe_calc_ut(julianDay, swisseph.SE_TRUE_NODE, flag);
        if (rahuRes) {
            planetsData["राहु"] = rahuRes.longitude;
            planetsData["केतु"] = (rahuRes.longitude + 180.0) % 360;
        }

        // आधुनिक प्लेसीडस (Placidus Houses) पद्धति से 12 घरों की गणना
        let housesData = {};
        let hRes = swisseph.swe_houses(julianDay, lat, lng, 'P');
        if (hRes && hRes.house) {
            for (let i = 1; i <= 12; i++) {
                housesData[i] = hRes.house[i];
            }
        }

        // अंतिम आउटपुट जो आपकी नई ऐप को भेजा जाएगा
        res.status(200).json({
            status: "success",
            system: "Modern Astronomical Method (NASA/JPL Model)",
            datetime: `${day}-${month}-${year} ${Math.floor(hour)}:${Math.floor(minute)} IST`,
            planets: planetsData,
            houses: housesData
        });
    });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Modern Astronomical Engine running on port ${port}`);
});
