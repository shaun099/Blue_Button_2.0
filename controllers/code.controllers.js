import axios from 'axios';

// A simple in-memory cache to avoid re-fetching the same code repeatedly
const codeCache = new Map();

/**
 * Fetches the description for a given ICD-10-PCS code from the NIH API.
 */
export const getCodeData = async (req, res) => {
    const { code } = req.params;

    // 1. Check our cache first for performance
    if (codeCache.has(code)) {
        return res.status(200).json({ description: codeCache.get(code) });
    }

    try {
        // 2. If not in cache, call the external NIH API
        const apiUrl = `https://clinicaltables.nlm.nih.gov/api/icd10pcs/v3/search?sf=code&terms=${code}`;
        const response = await axios.get(apiUrl);

        // The NIH API returns data in a unique array format.
        // The description is typically the second element of the first result item.
        const description = response.data[3]?.[0]?.[1] || `No description found for code ${code}`;

        // 3. Save the result to our cache for next time
        codeCache.set(code, description);

        // 4. Send the description back to our frontend
        res.status(200).json({ description });

    } catch (error) {
        console.error(`Failed to fetch description for code ${code}:`, error.message);
        res.status(500).json({ message: `Failed to retrieve description for code ${code}.` });
    }
};
