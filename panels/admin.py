from django.contrib import admin
from .models import (
    JointType, FinishGroup, Finish, ProfileColor,
    AluminumProfile, Order, Panel, DoorPanel,
    FramingModel, FramingColor, FramingProfilePrice,
    FramingDoborGroup, FramingDobor, FramingLead,
)


@admin.register(JointType)
class JointTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'series', 'name', 'offset_mm', 'price_per_meter', 'profile_article']
    list_filter = ['series']
    ordering = ['series', 'code']


@admin.register(FinishGroup)
class FinishGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'series', 'sort_order']
    list_filter = ['series']


@admin.register(Finish)
class FinishAdmin(admin.ModelAdmin):
    list_display = ['group', 'name', 'price_sqm']
    list_filter = ['group__series', 'group']
    search_fields = ['name']


@admin.register(ProfileColor)
class ProfileColorAdmin(admin.ModelAdmin):
    list_display = ['name', 'sort_order']


@admin.register(AluminumProfile)
class AluminumProfileAdmin(admin.ModelAdmin):
    list_display = ['article', 'name', 'length_mm', 'price_per_piece', 'joint_type_code']


class PanelInline(admin.TabularInline):
    model = Panel
    extra = 0
    fields = ['position', 'quantity', 'height_mm', 'width_mm',
              'joint_left', 'joint_right', 'joint_top', 'joint_bottom',
              'finish', 'markup_percent']


class DoorPanelInline(admin.TabularInline):
    model = DoorPanel
    extra = 0
    fields = ['position', 'opening_width', 'opening_height', 'ceiling_height',
              'mount_type', 'panel_height', 'panel_width', 'finish']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'series', 'order_number', 'customer_name', 'agent_name',
                    'city', 'order_date', 'created_at']
    list_filter = ['series', 'city', 'order_date']
    search_fields = ['customer_name', 'order_number', 'agent_name']
    inlines = [DoorPanelInline, PanelInline]
    readonly_fields = ['created_at', 'updated_at']


# ─── Обрамление проёма ────────────────────────────────────────────────────────

@admin.register(FramingProfilePrice)
class FramingProfilePriceAdmin(admin.ModelAdmin):
    list_display = ['category', 'price_per_3000']


@admin.register(FramingModel)
class FramingModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'subtitle', 'price_category', 'has_glass',
                    'depth_mode', 'depth_delta', 'sort_order']
    list_editable = ['price_category', 'sort_order']


@admin.register(FramingColor)
class FramingColorAdmin(admin.ModelAdmin):
    list_display = ['name', 'sort_order']


@admin.register(FramingDoborGroup)
class FramingDoborGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_dobor', 'is_glass', 'glass_price_per_m', 'sort_order']
    list_editable = ['is_dobor', 'is_glass', 'glass_price_per_m']


@admin.register(FramingDobor)
class FramingDoborAdmin(admin.ModelAdmin):
    list_display = ['name', 'group', 'price']
    list_filter = ['group']
    list_editable = ['price']
    search_fields = ['name']


@admin.register(FramingLead)
class FramingLeadAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_at', 'name', 'phone', 'model_name', 'total', 'status']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'phone', 'email']
    readonly_fields = ['created_at']
