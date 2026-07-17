from rest_framework import serializers
from .models import (
    JointType, FinishGroup, Finish, ProfileColor,
    AluminumProfile, Order, DoorPanel, Panel,
    FramingModel, FramingColor, FramingProfilePrice,
    FramingDoborGroup, FramingDobor, FramingLead,
)


class FramingModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = FramingModel
        fields = ['name', 'subtitle', 'nH', 'nL', 'dH', 'dL',
                  'depth_mode', 'depth_delta', 'profile_count',
                  'has_glass', 'price_category']


class FramingColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = FramingColor
        fields = ['name']


class FramingDoborSerializer(serializers.ModelSerializer):
    group = serializers.CharField(source='group.name')

    class Meta:
        model = FramingDobor
        fields = ['group', 'name', 'price']


class FramingDoborGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = FramingDoborGroup
        fields = ['name', 'is_dobor', 'is_glass', 'glass_price_per_m']


class FramingLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = FramingLead
        fields = [
            'id', 'created_at', 'status',
            'name', 'phone', 'email', 'comment',
            'invoice_number', 'buyer', 'note',
            'model_name', 'install', 'kit',
            'opening_height', 'opening_width', 'wall_depth',
            'color_name', 'dobor_name', 'glass',
            'spec', 'total',
        ]
        read_only_fields = ['id', 'created_at']


class JointTypeSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = JointType
        fields = ['id', 'code', 'name', 'offset_mm', 'price_per_meter',
                  'profile_article', 'profile_count', 'image', 'image_url']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return 'http://localhost:8000' + obj.image.url


class FinishSerializer(serializers.ModelSerializer):
    class Meta:
        model = Finish
        fields = ['id', 'name', 'price_sqm', 'decor_name']


class FinishGroupSerializer(serializers.ModelSerializer):
    finishes = FinishSerializer(many=True, read_only=True)

    class Meta:
        model = FinishGroup
        fields = ['id', 'name', 'sort_order', 'finishes']


class ProfileColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfileColor
        fields = ['id', 'name']


class AluminumProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AluminumProfile
        fields = '__all__'


# ─── Panels ──────────────────────────────────────────────────────────────────

class PanelSerializer(serializers.ModelSerializer):
    area_sqm = serializers.FloatField(read_only=True)
    finish_cost = serializers.FloatField(read_only=True)
    joint_side_cost = serializers.FloatField(read_only=True)
    joint_top_bottom_cost = serializers.FloatField(read_only=True)
    total_cost = serializers.FloatField(read_only=True)

    # read-only отображение для фронта
    joint_left_code = serializers.CharField(source='joint_left.code', read_only=True, default=None)
    joint_right_code = serializers.CharField(source='joint_right.code', read_only=True, default=None)
    joint_top_code = serializers.CharField(source='joint_top.code', read_only=True, default=None)
    joint_bottom_code = serializers.CharField(source='joint_bottom.code', read_only=True, default=None)
    finish_name = serializers.CharField(source='finish.name', read_only=True, default=None)
    finish_group_name = serializers.CharField(source='finish_group.name', read_only=True, default=None)
    aluminum_color_name = serializers.CharField(source='aluminum_color.name', read_only=True, default=None)

    class Meta:
        model = Panel
        fields = [
            'id', 'order', 'position', 'wall_number', 'quantity',
            'height_mm', 'width_mm',
            'joint_left', 'joint_left_code',
            'joint_right', 'joint_right_code',
            'joint_top', 'joint_top_code',
            'joint_bottom', 'joint_bottom_code',
            'finish_group', 'finish_group_name',
            'finish', 'finish_name',
            'veneer_direction', 'decor_name',
            'aluminum_vertical_count', 'aluminum_horizontal_count',
            'aluminum_color', 'aluminum_color_name',
            'markup_percent', 'notes',
            'area_sqm', 'finish_cost', 'joint_side_cost',
            'joint_top_bottom_cost', 'total_cost',
            'cascate_id', 'cascate_synced_at',
        ]
        read_only_fields = ['cascate_id', 'cascate_synced_at']


class DoorPanelSerializer(serializers.ModelSerializer):
    area_sqm = serializers.FloatField(read_only=True)
    edge_side_cost = serializers.FloatField(read_only=True)
    edge_top_bottom_cost = serializers.FloatField(read_only=True)
    finish_cost = serializers.FloatField(read_only=True)
    total_cost = serializers.FloatField(read_only=True)
    finish_name = serializers.CharField(source='finish.name', read_only=True, default=None)
    finish_group_name = serializers.CharField(source='finish_group.name', read_only=True, default=None)

    class Meta:
        model = DoorPanel
        fields = [
            'id', 'order', 'position', 'wall_number',
            'door_order_number', 'opening_width', 'opening_height', 'ceiling_height',
            'mount_type', 'opening_direction',
            'joint_top_left', 'joint_top_right', 'joint_bottom',
            'edge_left', 'edge_right', 'edge_top', 'edge_bottom',
            'quantity', 'panel_height', 'panel_width',
            'finish_group', 'finish_group_name',
            'finish', 'finish_name',
            'veneer_direction', 'decor_name',
            'markup_percent', 'notes',
            'area_sqm', 'edge_side_cost', 'edge_top_bottom_cost',
            'finish_cost', 'total_cost',
            'cascate_id', 'cascate_synced_at',
        ]
        read_only_fields = ['cascate_id', 'cascate_synced_at']


class OrderListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            'id', 'series', 'created_at', 'updated_at',
            'customer_name', 'agent_name', 'counterparty',
            'order_number', 'invoice_number', 'order_date', 'city',
            'cascate_synced_at',
        ]


class OrderDetailSerializer(serializers.ModelSerializer):
    panels = PanelSerializer(many=True, read_only=True)
    door_panels = DoorPanelSerializer(many=True, read_only=True)
    total_panels_cost = serializers.SerializerMethodField()
    total_door_panels_cost = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'series', 'created_at', 'updated_at',
            'customer_name', 'agent_name', 'counterparty',
            'order_number', 'invoice_number', 'order_date', 'city', 'notes',
            'configurator_state',
            'panels', 'door_panels',
            'total_panels_cost', 'total_door_panels_cost', 'total_cost',
            'cascate_id_person', 'cascate_synced_at',
        ]
        read_only_fields = ['cascate_id_person', 'cascate_synced_at']

    def get_total_panels_cost(self, obj):
        return sum(p.total_cost for p in obj.panels.all())

    def get_total_door_panels_cost(self, obj):
        return sum(d.total_cost for d in obj.door_panels.all())

    def get_total_cost(self, obj):
        return self.get_total_panels_cost(obj) + self.get_total_door_panels_cost(obj)
