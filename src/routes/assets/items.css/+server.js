// Temporary fix: Proxy item CSS from the production site
// This ensures we get the correct sprite positions

export async function GET({ url }) {
  // Get the query parameters
  const itemsParam = url.searchParams.get('i');
  
  // Build the URL for the production site
  let productionUrl = 'https://nuzlocke.app/assets/items.css';
  if (itemsParam) {
    productionUrl += `?i=${itemsParam}`;
  }
  
  try {
    // Fetch from production
    const response = await fetch(productionUrl);
    const css = await response.text();
    
             return new Response(css, {
               status: 200,
               headers: {
                 'Cache-Control': 'no-cache, no-store, must-revalidate',
                 'Pragma': 'no-cache',
                 'Expires': '0',
                 'Content-Type': 'text/css'
               }
             });
  } catch (error) {
    console.error('Error fetching item CSS from production:', error);
    
    // Fallback: return basic CSS for the most common items with correct positions from production
    const fallbackCss = `
.pkitem-custap-berry{background-position:-44px -443px;height:20px;width:20px}
.pkitem-air-balloon{background-position:-266px -417px;height:22px;width:18px}
.pkitem-berry-juice{background-position:-504px -322px;height:19px;width:20px}
.pkitem-oran-berry{background-position:-384px -272px;height:18px;width:19px}
.pkitem-sitrus-berry{background-position:-593px -394px;height:20px;width:18px}
.pkitem-lum-berry{background-position:-383px -154px;height:17px;width:18px}
.pkitem-focus-sash{background-position:-264px -467px;height:21px;width:20px}
.pkitem-life-orb{background-position:-165px -107px;height:16px;width:16px}
.pkitem-choice-band{background-position:-600px -666px;height:22px;width:22px}
.pkitem-choice-scarf{background-position:-624px -666px;height:22px;width:22px}
.pkitem-choice-specs{background-position:0 -346px;height:16px;width:22px}
.pkitem-leftovers{background-position:-150px -107px;height:20px;width:13px}
.pkitem-black-sludge{background-position:-87px -222px;height:17px;width:20px}
.pkitem-eviolite{background-position:-326px -13px;height:13px;width:13px}
.pkitem-assault-vest{background-position:-350px -322px;height:18px;width:21px}
`;
    
    return new Response(fallbackCss, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'text/css'
      }
    });
  }
}
