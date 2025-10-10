/**
 * API endpoint to fetch Radical Red calculation data from npoint.io
 * 
 * This endpoint acts as a proxy to get Dynamic-Calc's Radical Red data
 * which includes all trainer sets with detailed movesets, IVs, EVs, items, and abilities
 * 
 * GET /api/radred-calc-data.json?mode=normal|hardcore
 */

const RADRED_DATA_IDS = {
  normal: 'ced457ba9aa55731616c',    // Radical Red 4.1 Normal
  hardcore: 'e91164d90d06a009e6cc'   // Radical Red 4.1 Hardcore
};

export async function GET({ url }) {
  const mode = url.searchParams.get('mode') || 'normal';
  const dataId = RADRED_DATA_IDS[mode] || RADRED_DATA_IDS.normal;
  
  try {
    console.log(`[Radred Calc Data] Fetching ${mode} mode data from npoint.io`);
    
    const response = await fetch(`https://api.npoint.io/${dataId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Radical Red data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'X-Data-Source': 'npoint.io',
        'X-Data-Mode': mode
      }
    });
  } catch (error) {
    console.error(`[Radred Calc Data] Error:`, error.message);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch Radical Red calculation data',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

