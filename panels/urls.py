from rest_framework.routers import DefaultRouter
from .views import (
    JointTypeViewSet, FinishGroupViewSet, ProfileColorViewSet,
    AluminumProfileViewSet, OrderViewSet, PanelViewSet, DoorPanelViewSet,
)

router = DefaultRouter()
router.register(r'joint-types', JointTypeViewSet)
router.register(r'finish-groups', FinishGroupViewSet)
router.register(r'profile-colors', ProfileColorViewSet)
router.register(r'aluminum-profiles', AluminumProfileViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'panels', PanelViewSet, basename='panel')
router.register(r'door-panels', DoorPanelViewSet, basename='doorpanel')

urlpatterns = router.urls
