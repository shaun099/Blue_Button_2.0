import axios from "axios";
import querystring from "querystring";

export const getAuthUrl = (state,code_challenge) => {
  // A state parameter is now mandatory for security and multi-clinic functionality.
   if (!state || !code_challenge) {
    throw new Error("State and code_challenge are required.");
  }

  const params = {
    client_id: process.env.BB_CLIENT_ID,
    redirect_uri: process.env.BB_REDIRECT_URI,
    response_type: "code",
    state: state,
    
    // PKCE parameters required by Blue Button
    code_challenge: code_challenge,
    code_challenge_method: "S256",
  };

  return `${process.env.BB_AUTH_URL}?${querystring.stringify(params)}`;
};

const usedCodes = new Set();

export const exchangeCodeForToken = async (code,code_verifier) => {
  if (usedCodes.has(code)) {
    throw new Error("Authorization code has already been used");
  }
  if (!code || !code_verifier) {
    throw new Error("Authorization code and code_verifier are required.");
  }

  const authString = Buffer.from(
    `${process.env.BB_CLIENT_ID}:${process.env.BB_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      process.env.BB_TOKEN_URL,
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.BB_REDIRECT_URI,
          code_verifier: code_verifier,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authString}`,
        },
      }
    );

    if (!response.data.refresh_token || !response.data.patient) {
      throw new Error("Missing required token data in response");
    }

    // Mark code as used
    usedCodes.add(code);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      patientId: response.data.patient,
    };
  } catch (e) {
    console.error("Token exchange failed:", {
      error: e.response?.data || e.message,
      status: e.response?.status,
      headers: e.response?.headers,
    });
    throw new Error("Token exchange failed");
  }
};

export const exchangeRefreshToken = async (refreshToken) => {
  console.log("Refreshing access token................");
  const authString = Buffer.from(
    `${process.env.BB_CLIENT_ID}:${process.env.BB_CLIENT_SECRET}`
  ).toString("base64");
  console.log("authstring:", authString, ":end");

  try {
    const response = await axios.post(
      process.env.BB_TOKEN_URL,
      querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authString}`,
        },
      }
    );
    // Return only the new access token.
    
    return response.data;
  } catch (error) {
    console.error(
      "Failed to refresh access token:",
      error.response ? error.response.data : error.message
    );
    // If the refresh token is invalid or expired, the API will return an error.
    // You may need to handle this by marking the consent as invalid in your database.
    throw new Error(
      "Could not refresh access token. The patient may need to re-authenticate."
    );
  }
};
