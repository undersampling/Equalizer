from django.urls import path
from . import views

urlpatterns = [
    path('fft', views.compute_fft, name='compute_fft'),
    path('spectrogram', views.compute_spectrogram_view, name='compute_spectrogram'),
    path('equalize', views.equalize_signal, name='equalize_signal'),
]