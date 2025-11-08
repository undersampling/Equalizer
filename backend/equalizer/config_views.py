from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import json
import os
from pathlib import Path
from datetime import datetime

# Path to config file
CONFIG_DIR = Path(__file__).parent / 'config'
CONFIG_FILE = CONFIG_DIR / 'modes.json'

# Ensure config directory exists
CONFIG_DIR.mkdir(exist_ok=True)

# Default config if file doesn't exist
DEFAULT_CONFIG = {
    "version": "1.0",
    "lastUpdated": datetime.now().isoformat(),
    "modes": {
        "generic": {
            "mode": "generic",
            "name": "Generic Mode",
            "description": "Custom frequency bands with user-defined sliders",
            "allowCustomSliders": True,
            "icon": "⚙️",
            "sliders": []
        },
        "musical": {
            "mode": "musical",
            "name": "Musical Instruments Mode",
            "description": "Control individual musical instruments",
            "allowCustomSliders": False,
            "icon": "🎵",
            "sliders": [
                {
                    "id": 1,
                    "label": "🎸 Guitar",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[82, 1175]]
                },
                {
                    "id": 2,
                    "label": "🎹 Piano",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[27, 4186]]
                },
                {
                    "id": 3,
                    "label": "🥁 Drums",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[50, 200], [2000, 5000]]
                },
                {
                    "id": 4,
                    "label": "🎻 Violin",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[196, 3136]]
                }
            ]
        },
        "animal": {
            "mode": "animal",
            "name": "Animal Sounds Mode",
            "description": "Control different animal sounds",
            "allowCustomSliders": False,
            "icon": "🐾",
            "sliders": [
                {
                    "id": 1,
                    "label": "🐕 Dog",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[500, 1000]]
                },
                {
                    "id": 2,
                    "label": "🐈 Cat",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[700, 1500]]
                },
                {
                    "id": 3,
                    "label": "🐦 Bird",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[2000, 8000]]
                },
                {
                    "id": 4,
                    "label": "🐄 Cow",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[150, 500]]
                }
            ]
        },
        "human": {
            "mode": "human",
            "name": "Human Voices Mode",
            "description": "Control different human voice characteristics",
            "allowCustomSliders": False,
            "icon": "👤",
            "sliders": [
                {
                    "id": 1,
                    "label": "👨 Male Voice",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[85, 180]]
                },
                {
                    "id": 2,
                    "label": "👩 Female Voice",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[165, 255]]
                },
                {
                    "id": 3,
                    "label": "👴 Old Person",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[100, 200]]
                },
                {
                    "id": 4,
                    "label": "👦 Young Person",
                    "value": 1,
                    "min": 0,
                    "max": 2,
                    "freqRanges": [[200, 400]]
                }
            ]
        }
    }
}


def load_config():
    """Load configuration from JSON file"""
    if not CONFIG_FILE.exists():
        # Create default config if doesn't exist
        print(f"Config file not found, creating default at {CONFIG_FILE}")
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            print(f"Config loaded successfully from {CONFIG_FILE}")
            return config
    except Exception as e:
        print(f"Error loading config: {e}")
        return DEFAULT_CONFIG


def save_config(config):
    """Save configuration to JSON file"""
    try:
        # Update lastUpdated timestamp
        config['lastUpdated'] = datetime.now().isoformat()
        
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"Config saved successfully to {CONFIG_FILE}")
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False


@api_view(['GET'])
def get_all_modes(request):
    """
    Get all mode configurations
    """
    try:
        config = load_config()
        return Response(config, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': f'Failed to load modes: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_mode_config(request):
    """
    Get configuration for a specific mode
    Query params: ?mode=musical
    """
    try:
        mode = request.GET.get('mode')
        
        if not mode:
            return Response(
                {'error': 'Mode parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        config = load_config()
        
        if mode not in config.get('modes', {}):
            return Response(
                {'error': f'Mode "{mode}" not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(
            config['modes'][mode],
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to load mode config: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def update_mode_config(request):
    """
    Update configuration for a specific mode
    Payload: {
        "mode": "musical",
        "config": { ... mode config object ... }
    }
    """
    try:
        mode = request.data.get('mode')
        mode_config = request.data.get('config')
        
        if not mode or not mode_config:
            return Response(
                {'error': 'Both mode and config are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Load current config
        config = load_config()
        
        # Backup current config
        backup_file = CONFIG_DIR / f'modes.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        try:
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
            print(f"Backup created at {backup_file}")
        except Exception as e:
            print(f"Warning: Failed to create backup: {e}")
        
        # Update mode
        config['modes'][mode] = mode_config
        
        # Save updated config
        if save_config(config):
            return Response({
                'message': f'Mode "{mode}" updated successfully',
                'backupFile': backup_file.name,
                'lastUpdated': config['lastUpdated']
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Failed to save configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        return Response(
            {'error': f'Failed to update mode: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def update_slider_values(request):
    """
    Update slider values for a specific mode
    Payload: {
        "mode": "musical",
        "sliders": [...]
    }
    """
    try:
        mode = request.data.get('mode')
        sliders = request.data.get('sliders')
        
        if not mode or not sliders:
            return Response(
                {'error': 'Both mode and sliders are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        config = load_config()
        
        if mode not in config['modes']:
            return Response(
                {'error': f'Mode "{mode}" not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update slider values
        config['modes'][mode]['sliders'] = sliders
        
        if save_config(config):
            return Response({
                'message': f'Sliders updated for mode "{mode}"',
                'lastUpdated': config['lastUpdated']
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Failed to save configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        return Response(
            {'error': f'Failed to update sliders: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def reset_to_default(request):
    """
    Reset all configurations to default
    Optional query param: ?mode=musical (reset single mode)
    """
    try:
        mode = request.GET.get('mode', None)
        
        # Backup current config
        if CONFIG_FILE.exists():
            backup_file = CONFIG_DIR / f'modes.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            import shutil
            shutil.copy(CONFIG_FILE, backup_file)
            print(f"Backup created at {backup_file}")
        
        if mode:
            # Reset single mode
            if mode not in DEFAULT_CONFIG['modes']:
                return Response(
                    {'error': f'Mode "{mode}" not found in defaults'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            config = load_config()
            config['modes'][mode] = DEFAULT_CONFIG['modes'][mode]
            
            if save_config(config):
                return Response({
                    'message': f'Mode "{mode}" reset to default successfully',
                    'backupCreated': True
                }, status=status.HTTP_200_OK)
        else:
            # Reset all modes
            if save_config(DEFAULT_CONFIG):
                return Response({
                    'message': 'All configurations reset to default successfully',
                    'backupCreated': True
                }, status=status.HTTP_200_OK)
        
        return Response(
            {'error': 'Failed to reset configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to reset: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_config_info(request):
    """
    Get information about the configuration file
    """
    try:
        config = load_config()
        
        # Get file stats
        file_stats = None
        if CONFIG_FILE.exists():
            stats = CONFIG_FILE.stat()
            file_stats = {
                'size': stats.st_size,
                'modified': datetime.fromtimestamp(stats.st_mtime).isoformat(),
                'created': datetime.fromtimestamp(stats.st_ctime).isoformat(),
            }
        
        info = {
            'version': config.get('version', 'Unknown'),
            'lastUpdated': config.get('lastUpdated', 'Unknown'),
            'configFile': str(CONFIG_FILE),
            'configExists': CONFIG_FILE.exists(),
            'modesCount': len(config.get('modes', {})),
            'modes': list(config.get('modes', {}).keys()),
            'fileStats': file_stats,
        }
        
        # Add slider counts per mode
        slider_counts = {}
        for mode_name, mode_config in config.get('modes', {}).items():
            slider_counts[mode_name] = len(mode_config.get('sliders', []))
        info['sliderCounts'] = slider_counts
        
        return Response(info, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': f'Failed to get config info: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )