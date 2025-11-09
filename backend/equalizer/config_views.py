from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import json
import os
from pathlib import Path
from datetime import datetime
import shutil

# Paths
CONFIG_DIR = Path(__file__).parent / 'config'
CONFIG_FILE = CONFIG_DIR / 'modes.json'
ORIGINAL_FILE = CONFIG_DIR / 'original.json'

# Ensure config directory exists
CONFIG_DIR.mkdir(exist_ok=True)


def load_config():
    """Load configuration from modes.json"""
    if not CONFIG_FILE.exists():
        # If modes.json doesn't exist, copy from original.json
        if ORIGINAL_FILE.exists():
            shutil.copy(ORIGINAL_FILE, CONFIG_FILE)
            print(f"Created modes.json from original.json")
        else:
            print(f"ERROR: original.json not found at {ORIGINAL_FILE}")
            return None
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            return config
    except Exception as e:
        print(f"Error loading config: {e}")
        return None


def save_config(config):
    """Save configuration to modes.json (NO BACKUP)"""
    try:
        config['lastUpdated'] = datetime.now().isoformat()
        
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False


def load_original_config():
    """Load original default configuration"""
    try:
        with open(ORIGINAL_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading original config: {e}")
        return None


@api_view(['GET'])
def get_all_modes(request):
    """Get all mode configurations from modes.json"""
    config = load_config()
    if config is None:
        return Response(
            {'error': 'Failed to load configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    return Response(config, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_mode_config(request):
    """Get configuration for a specific mode"""
    mode = request.GET.get('mode')
    
    if not mode:
        return Response(
            {'error': 'Mode parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    config = load_config()
    if config is None:
        return Response(
            {'error': 'Failed to load configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    if mode not in config.get('modes', {}):
        return Response(
            {'error': f'Mode "{mode}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    return Response(config['modes'][mode], status=status.HTTP_200_OK)


@api_view(['POST'])
def update_mode_config(request):
    """Update configuration for a specific mode"""
    mode = request.data.get('mode')
    mode_config = request.data.get('config')
    
    if not mode or not mode_config:
        return Response(
            {'error': 'Both mode and config are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    config = load_config()
    if config is None:
        return Response(
            {'error': 'Failed to load configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Update mode
    config['modes'][mode] = mode_config
    
    if save_config(config):
        return Response({
            'message': f'Mode "{mode}" updated successfully',
            'lastUpdated': config['lastUpdated']
        }, status=status.HTTP_200_OK)
    
    return Response(
        {'error': 'Failed to save configuration'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


@api_view(['POST'])
def update_slider_values(request):
    """Update slider values for a specific mode"""
    mode = request.data.get('mode')
    sliders = request.data.get('sliders')
    
    if not mode or not sliders:
        return Response(
            {'error': 'Both mode and sliders are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    config = load_config()
    if config is None:
        return Response(
            {'error': 'Failed to load configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
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
    
    return Response(
        {'error': 'Failed to save configuration'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


@api_view(['POST'])
def reset_to_default(request):
    """Reset configurations to default from original.json"""
    mode = request.GET.get('mode', None)
    
    original_config = load_original_config()
    if original_config is None:
        return Response(
            {'error': 'Failed to load original configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    if mode:
        # Reset single mode
        if mode not in original_config['modes']:
            return Response(
                {'error': f'Mode "{mode}" not found in defaults'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        config = load_config()
        if config is None:
            return Response(
                {'error': 'Failed to load current configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        config['modes'][mode] = original_config['modes'][mode]
        
        if save_config(config):
            return Response({
                'message': f'Mode "{mode}" reset to default successfully'
            }, status=status.HTTP_200_OK)
    else:
        # Reset all modes
        if save_config(original_config):
            return Response({
                'message': 'All configurations reset to default successfully'
            }, status=status.HTTP_200_OK)
    
    return Response(
        {'error': 'Failed to reset configuration'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


@api_view(['GET'])
def get_config_info(request):
    """Get information about the configuration file"""
    config = load_config()
    if config is None:
        return Response(
            {'error': 'Failed to load configuration'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    file_stats = None
    if CONFIG_FILE.exists():
        stats = CONFIG_FILE.stat()
        file_stats = {
            'size': stats.st_size,
            'modified': datetime.fromtimestamp(stats.st_mtime).isoformat(),
            'created': datetime.fromtimestamp(stats.st_ctime).isoformat(),
        }
    
    slider_counts = {}
    for mode_name, mode_config in config.get('modes', {}).items():
        slider_counts[mode_name] = len(mode_config.get('sliders', []))
    
    info = {
        'version': config.get('version', 'Unknown'),
        'lastUpdated': config.get('lastUpdated', 'Unknown'),
        'configFile': str(CONFIG_FILE),
        'originalFile': str(ORIGINAL_FILE),
        'configExists': CONFIG_FILE.exists(),
        'originalExists': ORIGINAL_FILE.exists(),
        'modesCount': len(config.get('modes', {})),
        'modes': list(config.get('modes', {}).keys()),
        'fileStats': file_stats,
        'sliderCounts': slider_counts,
    }
    
    return Response(info, status=status.HTTP_200_OK)