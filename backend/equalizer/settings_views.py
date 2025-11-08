from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import json
import os
from pathlib import Path
from datetime import datetime

# Settings directory - create it in the api folder
SETTINGS_DIR = Path(__file__).parent / 'settings'
SETTINGS_DIR.mkdir(exist_ok=True)

@api_view(['POST'])
def save_settings(request):
    """
    Save settings to server
    Payload: {
        "mode": "generic|musical|animal|human",
        "sliders": [...],
        "presetName": "optional preset name"
    }
    """
    try:
        mode = request.data.get('mode')
        sliders = request.data.get('sliders', [])
        preset_name = request.data.get('presetName', None)
        
        if not mode:
            return Response(
                {'error': 'Mode is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not sliders:
            return Response(
                {'error': 'Sliders are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate mode
        valid_modes = ['generic', 'musical', 'animal', 'human']
        if mode not in valid_modes:
            return Response(
                {'error': f'Invalid mode. Must be one of: {", ".join(valid_modes)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create settings object
        settings = {
            'mode': mode,
            'sliders': sliders,
            'timestamp': datetime.now().isoformat(),
            'presetName': preset_name,
            'version': '1.0'
        }
        
        # Determine filename
        if preset_name:
            # Sanitize preset name for filename
            safe_preset_name = "".join(c for c in preset_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_preset_name = safe_preset_name.replace(' ', '_')
            filename = f"{mode}_{safe_preset_name}.json"
        else:
            filename = f"{mode}_default.json"
        
        filepath = SETTINGS_DIR / filename
        
        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        
        return Response({
            'message': 'Settings saved successfully',
            'filename': filename,
            'path': str(filepath)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to save settings: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def load_settings(request):
    """
    Load settings from server
    Query params: ?mode=musical&presetName=mypreset
    """
    try:
        mode = request.GET.get('mode')
        preset_name = request.GET.get('presetName', None)
        
        if not mode:
            return Response(
                {'error': 'Mode parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Determine filename
        if preset_name:
            # Sanitize preset name
            safe_preset_name = "".join(c for c in preset_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_preset_name = safe_preset_name.replace(' ', '_')
            filename = f"{mode}_{safe_preset_name}.json"
        else:
            filename = f"{mode}_default.json"
        
        filepath = SETTINGS_DIR / filename
        
        # Check if file exists
        if not filepath.exists():
            return Response(
                {'error': f'Settings file not found: {filename}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Load from file
        with open(filepath, 'r', encoding='utf-8') as f:
            settings = json.load(f)
        
        return Response(settings, status=status.HTTP_200_OK)
        
    except json.JSONDecodeError as e:
        return Response(
            {'error': f'Invalid JSON in settings file: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to load settings: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def list_presets(request):
    """
    List all available presets
    Query params: ?mode=musical (optional)
    """
    try:
        mode = request.GET.get('mode', None)
        
        # Get all JSON files in settings directory
        if mode:
            pattern = f"{mode}_*.json"
        else:
            pattern = "*.json"
        
        presets = []
        for filepath in SETTINGS_DIR.glob(pattern):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                    
                    presets.append({
                        'filename': filepath.name,
                        'mode': settings.get('mode'),
                        'presetName': settings.get('presetName'),
                        'timestamp': settings.get('timestamp'),
                        'sliderCount': len(settings.get('sliders', [])),
                        'version': settings.get('version', '1.0')
                    })
            except (json.JSONDecodeError, KeyError) as e:
                # Skip invalid JSON files
                print(f"Skipping invalid settings file {filepath.name}: {e}")
                continue
        
        # Sort by timestamp (newest first)
        presets.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return Response({'presets': presets}, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to list presets: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
def delete_preset(request):
    """
    Delete a preset
    Query params: ?mode=musical&presetName=mypreset
    """
    try:
        mode = request.GET.get('mode')
        preset_name = request.GET.get('presetName')
        
        if not mode or not preset_name:
            return Response(
                {'error': 'Both mode and presetName parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Sanitize preset name
        safe_preset_name = "".join(c for c in preset_name if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_preset_name = safe_preset_name.replace(' ', '_')
        filename = f"{mode}_{safe_preset_name}.json"
        
        filepath = SETTINGS_DIR / filename
        
        if not filepath.exists():
            return Response(
                {'error': f'Preset not found: {filename}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Don't allow deleting default presets
        if filename.endswith('_default.json'):
            return Response(
                {'error': 'Cannot delete default preset'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Delete file
        filepath.unlink()
        
        return Response({
            'message': f'Preset "{preset_name}" deleted successfully',
            'filename': filename
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to delete preset: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_settings_info(request):
    """
    Get information about the settings system
    """
    try:
        # Count files by mode
        mode_counts = {
            'generic': len(list(SETTINGS_DIR.glob('generic_*.json'))),
            'musical': len(list(SETTINGS_DIR.glob('musical_*.json'))),
            'animal': len(list(SETTINGS_DIR.glob('animal_*.json'))),
            'human': len(list(SETTINGS_DIR.glob('human_*.json'))),
        }
        
        total_presets = sum(mode_counts.values())
        
        return Response({
            'settingsDirectory': str(SETTINGS_DIR),
            'totalPresets': total_presets,
            'presetsByMode': mode_counts,
            'version': '1.0'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to get settings info: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )