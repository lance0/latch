import { NextRequest, NextResponse } from 'next/server';
import { oboTokenForApi } from '@lance0/latch';

/**
 * Example: Call a custom downstream API using On-Behalf-Of (OBO) flow
 *
 * This demonstrates the middle-tier scenario where:
 * 1. Your Next.js API receives a bearer token from a client (SPA, mobile app, etc.)
 * 2. You need to call a downstream API on behalf of the authenticated user
 * 3. You exchange the incoming token for a token scoped to the downstream API
 *
 * Prerequisites:
 * - Your Azure AD app must have delegated permissions to the downstream API
 * - Admin consent must be granted for those permissions
 * - The incoming token must have audience (aud) set to YOUR API's client ID
 * - Configure LATCH_CLIENT_SECRET or certificate for confidential client auth
 *
 * Setup in Azure AD:
 * 1. Go to your API's App Registration → API permissions
 * 2. Add permission → My APIs → Select downstream API
 * 3. Choose delegated permissions (e.g., "Read", "Write")
 * 4. Grant admin consent
 *
 * @example
 * // Client calls this endpoint with their access token:
 * fetch('/api/downstream-api', {
 *   headers: {
 *     'Authorization': `Bearer ${userAccessToken}`
 *   }
 * });
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Get OBO token for downstream API
    // This validates the incoming bearer token and exchanges it for a new token
    // scoped to the downstream API
    const downstreamToken = await oboTokenForApi(request, {
      // The audience of the downstream API
      // Can be app ID URI (api://downstream) or client ID
      audience: 'api://my-downstream-api',

      // Use /.default to request all delegated permissions granted to your app
      // Or specify individual scopes: ['api://downstream/Read', 'api://downstream/Write']
      scopes: ['api://my-downstream-api/.default'],
    });

    // Step 2: Call downstream API with OBO token
    const downstreamResponse = await fetch('https://my-downstream-api.example.com/data', {
      headers: {
        Authorization: `Bearer ${downstreamToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!downstreamResponse.ok) {
      const errorText = await downstreamResponse.text();
      return NextResponse.json(
        {
          error: 'Downstream API call failed',
          details: errorText,
          status: downstreamResponse.status,
        },
        { status: downstreamResponse.status }
      );
    }

    const data = await downstreamResponse.json();

    // Step 3: Return data to client
    return NextResponse.json({
      success: true,
      data,
      source: 'downstream-api',
    });
  } catch (error) {
    console.error('[OBO Example] Error:', error);

    // Handle specific OBO errors
    const err = error as { code?: string; details?: { claims?: string } };
    if (err.code === 'LATCH_OBO_INVALID_ASSERTION') {
      return NextResponse.json(
        {
          error: 'Invalid or missing bearer token',
          message: 'Ensure Authorization header contains a valid Bearer token',
          code: err.code,
        },
        { status: 401 }
      );
    }

    if (err.code === 'LATCH_OBO_AUDIENCE_MISMATCH') {
      return NextResponse.json(
        {
          error: 'Token not for this API',
          message: 'The bearer token audience does not match this API. Ensure the token was requested with the correct audience.',
          code: err.code,
        },
        { status: 403 }
      );
    }

    if (err.code === 'LATCH_OBO_EXCHANGE_FAILED') {
      return NextResponse.json(
        {
          error: 'OBO token exchange failed',
          message: 'Failed to exchange token. Check Azure AD permissions and consent.',
          code: err.code,
          details: err.details,
        },
        { status: 500 }
      );
    }

    if (err.code === 'LATCH_OBO_CAE_REQUIRED') {
      // CAE (Continuous Access Evaluation) claims challenge
      // The client needs to get a new token with the required claims
      return NextResponse.json(
        {
          error: 'Claims challenge required',
          message: 'Additional claims required for this operation',
          code: err.code,
          claims: err.details?.claims, // Return claims to client
        },
        {
          status: 401,
          headers: {
            // Standard WWW-Authenticate header for CAE
            'WWW-Authenticate': `Bearer realm="", error="insufficient_claims", claims="${err.details?.claims}"`,
          },
        }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'Failed to call downstream API',
        message: (error as Error).message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Example POST endpoint showing OBO with request body
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Get OBO token
    const downstreamToken = await oboTokenForApi(request, {
      audience: 'api://my-downstream-api',
      scopes: ['api://my-downstream-api/.default'],
    });

    // Call downstream API with POST
    const downstreamResponse = await fetch('https://my-downstream-api.example.com/data', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${downstreamToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!downstreamResponse.ok) {
      throw new Error(`Downstream API error: ${downstreamResponse.statusText}`);
    }

    const data = await downstreamResponse.json();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[OBO Example] POST Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
