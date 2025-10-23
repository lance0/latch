import { NextRequest, NextResponse } from 'next/server';
import { oboTokenForGraph, getAzureEndpoints, getLatchConfig } from '@lance0/latch';

/**
 * Example: Call Microsoft Graph API using On-Behalf-Of (OBO) flow
 *
 * This demonstrates calling Microsoft Graph on behalf of a user when your API
 * receives a bearer token from a client application.
 *
 * Use Cases:
 * - SPA → Your Next.js API → Microsoft Graph (single hop)
 * - Mobile app → Your Next.js API → Microsoft Graph
 * - External client → Your Next.js API → Microsoft Graph
 *
 * Prerequisites:
 * - Your Azure AD app must have delegated Microsoft Graph permissions
 * - Admin consent granted for Graph permissions (User.Read, Mail.Read, etc.)
 * - Incoming token must have audience (aud) set to YOUR API's client ID
 * - LATCH_CLIENT_SECRET or certificate configured
 *
 * Sovereign Cloud Notes:
 * - GCC-High: Uses graph.microsoft.us
 * - DoD: Uses dod-graph.microsoft.us
 * - Latch automatically handles endpoint selection based on LATCH_CLOUD
 *
 * @example
 * // Client calls with their access token:
 * const response = await fetch('/api/graph-obo', {
 *   headers: {
 *     'Authorization': `Bearer ${userAccessToken}`
 *   }
 * });
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

    // Step 1: Get OBO token for Microsoft Graph
    // This automatically uses the correct Graph endpoint for your cloud
    const graphToken = await oboTokenForGraph(request, {
      scopes: ['User.Read'], // Request specific Graph permissions
    });

    // Step 2: Call Microsoft Graph with OBO token
    // Note: Uses correct Graph base URL for sovereign clouds
    const graphUrl = `${endpoints.graphBaseUrl}/v1.0/me`;

    const graphResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      return NextResponse.json(
        {
          error: 'Microsoft Graph API error',
          details: errorText,
          status: graphResponse.status,
        },
        { status: graphResponse.status }
      );
    }

    const profile = await graphResponse.json();

    // Step 3: Return Graph data to client
    return NextResponse.json({
      success: true,
      profile,
      cloud: config.cloud,
      graphEndpoint: endpoints.graphBaseUrl,
    });
  } catch (error) {
    console.error('[Graph OBO Example] Error:', error);

    // Handle OBO-specific errors
    const err = error as { code?: string; message?: string };
    if (err.code?.startsWith('LATCH_OBO_')) {
      return NextResponse.json(
        {
          error: 'OBO flow failed',
          code: err.code,
          message: err.message,
        },
        { status: err.code === 'LATCH_OBO_INVALID_ASSERTION' ? 401 : 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch user profile',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * Example: Get user's emails from Microsoft Graph
 *
 * Demonstrates OBO with additional Graph permissions
 */
export async function POST(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

    // Get the action from request body
    const body = await request.json();
    const action = body.action || 'profile';

    // Get OBO token with appropriate scopes
    let scopes: string[];
    let graphPath: string;

    switch (action) {
      case 'emails':
        scopes = ['Mail.Read'];
        graphPath = '/v1.0/me/messages?$top=10';
        break;

      case 'calendar':
        scopes = ['Calendars.Read'];
        graphPath = '/v1.0/me/events?$top=10';
        break;

      case 'profile':
      default:
        scopes = ['User.Read'];
        graphPath = '/v1.0/me';
        break;
    }

    // Get OBO token for Graph with requested scopes
    const graphToken = await oboTokenForGraph(request, { scopes });

    // Call Microsoft Graph
    const graphUrl = `${endpoints.graphBaseUrl}${graphPath}`;
    const graphResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
      },
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      throw new Error(`Graph API error: ${errorText}`);
    }

    const data = await graphResponse.json();

    return NextResponse.json({
      success: true,
      action,
      data,
      cloud: config.cloud,
    });
  } catch (error) {
    console.error('[Graph OBO Example] POST Error:', error);

    const err = error as { code?: string; message?: string };
    return NextResponse.json(
      {
        error: 'Failed to fetch Graph data',
        message: err.message,
        code: err.code,
      },
      { status: 500 }
    );
  }
}
