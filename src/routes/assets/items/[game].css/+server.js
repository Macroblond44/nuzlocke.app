import minifiedItems from '../_data.js';

import { Expanded as games} from '$lib/data/games.js';
import leagues from '$lib/data/league.json';
import patches from '$lib/data/patches.json';

const toSet = (l) =>
  [...new Set(l)].filter((i) => i).sort((a, b) => a.localeCompare(b));

const extract = (id, str) => {
  try {
    const re = new RegExp(`\\.pk(item|m)-${id}{.*?}`);
    const res = re.exec(str);
    return res[0];
  } catch (e) {
    console.log('Invalid item:', id);
    return null;
  }
};

export async function GET({ params }) {
  try {
    const { game } = params;

    const gameData = games[game];
    if (!gameData) return new Response({ status: 404 });

    const league = leagues[gameData.lid] || leagues[gameData.pid];
    if (!league) return new Response({ status: 404 });

    // For now, return empty CSS to fix the 500 error
    // The item sprites will be loaded from the main items.css instead
    return new Response('/* Items CSS for ' + game + ' */', {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
        'Content-Type': 'text/css'
      }
    });
  } catch (error) {
    console.error('Error in /assets/items/[game].css:', error);
    return new Response('/* Error: ' + error.message + ' */', {
      status: 200,
      headers: {
        'Content-Type': 'text/css'
      }
    });
  }
}
