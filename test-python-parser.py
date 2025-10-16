#!/usr/bin/env python3

import sys
import os

# Add the rr-pokemon-exporter src directory to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
rr_src_path = os.path.join(current_dir, 'rr-pokemon-exporter', 'src')
sys.path.insert(0, rr_src_path)

from save_file import SaveFile
from pokemon_extractor import PartyPokemonExtractor, BoxPokemonExtractor
from pokemon_parser import PartyPokemonParser, BoxPokemonParser
from data_manager import GameDataManager

def parse_sav_file(sav_path):
    print(f"🔍 [Python] Parsing .sav file: {sav_path}")
    
    try:
        with open(sav_path, "rb") as f:
            raw = f.read()
        
        print(f"🔍 [Python] File size: {len(raw)} bytes")
        
        save = SaveFile(raw)
        print(f"🔍 [Python] Save file loaded successfully")
        
        # Extract party Pokemon
        print("\n🎮 [Python] Extracting party Pokemon...")
        party_extractor = PartyPokemonExtractor(save.active_block)
        party_parser = PartyPokemonParser()
        
        party_raw = party_extractor.pokemon_in_party
        print(f"🔍 [Python] Found {len(party_raw)} party Pokemon slots")
        
        party = []
        for i, p in enumerate(party_raw):
            if p:  # Only parse non-empty slots
                try:
                    pokemon = party_parser.parse(p)
                    party.append(pokemon)
                    print(f"🔍 [Python] Party slot {i}: {pokemon.species_id} (Level {pokemon.level})")
                except Exception as e:
                    print(f"🔍 [Python] Error parsing party slot {i}: {e}")
        
        # Extract box Pokemon
        print("\n📦 [Python] Extracting box Pokemon...")
        box_extractor = BoxPokemonExtractor(save.active_block, save.expanded_block)
        box_parser = BoxPokemonParser()
        
        box_raw = box_extractor.pokemon_in_storage
        print(f"🔍 [Python] Found {len(box_raw)} box Pokemon slots")
        
        boxes = []
        current_box = []
        pokemon_count = 0
        
        for i, p in enumerate(box_raw):
            if p:  # Only parse non-empty slots
                try:
                    pokemon = box_parser.parse(p)
                    current_box.append(pokemon)
                    print(f"🔍 [Python] Box Pokemon {pokemon_count}: {pokemon.species_id} (Level {pokemon.level})")
                except Exception as e:
                    print(f"🔍 [Python] Error parsing box slot {i}: {e}")
            
            pokemon_count += 1
            
            # Every 30 Pokemon, start a new box
            if pokemon_count % 30 == 0:
                boxes.append(current_box)
                print(f"🔍 [Python] Box {len(boxes)-1} complete: {len(current_box)} Pokemon found")
                current_box = []
        
        # Add the last box if it has Pokemon
        if current_box:
            boxes.append(current_box)
            print(f"🔍 [Python] Final box complete: {len(current_box)} Pokemon found")
        
        print(f"\n✅ [Python] SUCCESS! Parsing completed!")
        print(f"📊 [Python] Summary:")
        print(f"   - Party Pokemon: {len(party)}")
        print(f"   - Box Pokemon: {sum(len(box) for box in boxes)}")
        print(f"   - Total Pokemon: {len(party) + sum(len(box) for box in boxes)}")
        
        # Show Pokemon names using the data manager
        data_manager = GameDataManager()
        
        if party:
            print(f"\n🎮 [Python] Party Pokemon:")
            for i, pkmn in enumerate(party):
                species_name = data_manager.get_species_name(pkmn.species_id)
                print(f"   {i+1}. {species_name} (Lv.{pkmn.level})")
                # Debug: Show all available properties
                print(f"      Properties: {dir(pkmn)}")
                print(f"      Ability: {getattr(pkmn, 'ability', 'N/A')}")
                print(f"      Nature: {getattr(pkmn, 'nature', 'N/A')}")
                print(f"      Moves: {getattr(pkmn, 'moves', 'N/A')}")
                print(f"      Gender: {getattr(pkmn, 'gender', 'N/A')}")
                print(f"      Item: {getattr(pkmn, 'item', 'N/A')}")
                print(f"      Stats: {getattr(pkmn, 'stats', 'N/A')}")
                print(f"      IVs attributes: {dir(pkmn.ivs)}")
                print(f"      EVs attributes: {dir(pkmn.evs)}")
                break  # Only show first Pokemon for debugging
        
        if any(boxes):
            print(f"\n📦 [Python] Box Pokemon:")
            for box_idx, box in enumerate(boxes):
                if box:
                    print(f"   Box {box_idx}:")
                    for i, pkmn in enumerate(box):
                        species_name = data_manager.get_species_name(pkmn.species_id)
                        print(f"     {i+1}. {species_name} (Lv.{pkmn.level})")
        
        # Convert Pokemon objects to dictionaries for JSON serialization
        def pokemon_to_dict(pkmn):
            # Get move names from IDs
            move_names = [data_manager.get_move_name(move_id) for move_id in pkmn.move_ids if move_id > 0]
            
            # Get ability name
            ability_name = data_manager.get_ability_name(
                pkmn.ability_index, 
                data_manager.get_species_name(pkmn.species_id), 
                pkmn.has_ha_flag
            )
            
            # Get item name
            item_name = data_manager.get_item_name(pkmn.held_item_id)
            
            return {
                'species_id': pkmn.species_id,
                'name': data_manager.get_species_name(pkmn.species_id).lower(),
                'level': pkmn.level,
                'ability_index': pkmn.ability_index,
                'ability_name': ability_name,
                'nature': pkmn.nature,
                'move_ids': pkmn.move_ids,
                'move_names': move_names,
                'held_item_id': pkmn.held_item_id,
                'held_item_name': item_name,
                'ivs': {
                    'hp': pkmn.ivs.hp,
                    'attack': pkmn.ivs.attack,
                    'defense': pkmn.ivs.defense,
                    'special_attack': pkmn.ivs.special_attack,
                    'special_defense': pkmn.ivs.special_defense,
                    'speed': pkmn.ivs.speed
                },
                'evs': {
                    'hp': pkmn.evs.hp,
                    'attack': pkmn.evs.attack,
                    'defense': pkmn.evs.defense,
                    'special_attack': pkmn.evs.special_attack,
                    'special_defense': pkmn.evs.special_defense,
                    'speed': pkmn.evs.speed
                },
                'nickname': pkmn.nickname,
                'gender': getattr(pkmn, 'gender', None),
                'is_egg': pkmn.is_egg_flag,
                'has_hidden_ability': pkmn.has_ha_flag
            }
        
        # Convert party Pokemon
        party_dicts = [pokemon_to_dict(pkmn) for pkmn in party]
        
        # Convert box Pokemon
        boxes_dicts = []
        for box in boxes:
            box_dicts = [pokemon_to_dict(pkmn) for pkmn in box]
            boxes_dicts.append(box_dicts)
        
        result = {
            'party': party_dicts,
            'boxes': boxes_dicts,
            'total_pokemon': len(party) + sum(len(box) for box in boxes)
        }
        
        # Output JSON for API consumption
        import json
        print("\n" + "="*50)
        print("JSON OUTPUT:")
        print("="*50)
        print(json.dumps(result, indent=2))
        
        return result
        
    except Exception as e:
        print(f"❌ [Python] Error parsing save file: {e}")
        raise

if __name__ == "__main__":
    sav_path = sys.argv[1] if len(sys.argv) > 1 else './radicalred 4.1.sav'
    parse_sav_file(sav_path)
