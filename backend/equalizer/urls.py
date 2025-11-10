from django.urls import path
from .views import (
    compute_fft, compute_spectrogram_view, equalize_signal, 
    separate_music_ai, apply_stem_mixing,
    separate_voices_ai, mix_voices_with_gains
)
from . import config_views, settings_views


urlpatterns = [
    # Signal processing endpoints
    path('fft', compute_fft, name='compute_fft'),
    path('spectrogram', compute_spectrogram_view, name='compute_spectrogram'),
    path('equalize', equalize_signal, name='equalize_signal'),
    path('separate-music', separate_music_ai, name='separate_music_ai'),
    path('mix-stems', apply_stem_mixing, name='apply_stem_mixing'),
    path('separate-voices', separate_voices_ai, name='separate_voices'),
    path('mix-voices', mix_voices_with_gains, name='mix_voices'),
    # Mode configuration endpoints
    path('modes/all', config_views.get_all_modes, name='get_all_modes'),
    path('modes/config', config_views.get_mode_config, name='get_mode_config'),
    path('modes/update', config_views.update_mode_config, name='update_mode_config'),
    path('modes/update-sliders', config_views.update_slider_values, name='update_slider_values'),
    path('modes/reset', config_views.reset_to_default, name='reset_to_default'),
    path('modes/info', config_views.get_config_info, name='get_config_info'),
    
    # Settings/presets endpoints
    path('settings/save', settings_views.save_settings, name='save_settings'),
    path('settings/load', settings_views.load_settings, name='load_settings'),
    path('settings/presets', settings_views.list_presets, name='list_presets'),
    path('settings/delete', settings_views.delete_preset, name='delete_preset'),
    path('settings/info', settings_views.get_settings_info, name='get_settings_info'),
]