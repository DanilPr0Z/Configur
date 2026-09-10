from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    JointTypeViewSet, FinishGroupViewSet, ProfileColorViewSet,
    AluminumProfileViewSet, OrderViewSet, PanelViewSet, DoorPanelViewSet,
    FramingConfigView, FramingLeadViewSet, CascateLoginView,
)

router = DefaultRouter()
router.register(r'joint-types', JointTypeViewSet)
router.register(r'finish-groups', FinishGroupViewSet)
router.register(r'profile-colors', ProfileColorViewSet)
router.register(r'aluminum-profiles', AluminumProfileViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'panels', PanelViewSet, basename='panel')
router.register(r'door-panels', DoorPanelViewSet, basename='doorpanel')
router.register(r'framing-leads', FramingLeadViewSet, basename='framinglead')

urlpatterns = router.urls + [
    path('framing/config/', FramingConfigView.as_view()),
    path('auth/cascate-login/', CascateLoginView.as_view()),
]
