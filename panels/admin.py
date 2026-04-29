from django.contrib import admin
from .models import (
    JointType, FinishGroup, Finish, ProfileColor,
    AluminumProfile, Order, Panel, DoorPanel,
)


@admin.register(JointType)
class JointTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'offset_mm', 'price_per_meter', 'profile_article']
    ordering = ['code']


@admin.register(FinishGroup)
class FinishGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'sort_order']


@admin.register(Finish)
class FinishAdmin(admin.ModelAdmin):
    list_display = ['group', 'name', 'price_sqm']
    list_filter = ['group']
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
    list_display = ['id', 'order_number', 'customer_name', 'agent_name',
                    'city', 'order_date', 'created_at']
    list_filter = ['city', 'order_date']
    search_fields = ['customer_name', 'order_number', 'agent_name']
    inlines = [DoorPanelInline, PanelInline]
    readonly_fields = ['created_at', 'updated_at']
