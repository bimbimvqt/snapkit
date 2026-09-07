import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:get/get.dart';

import '../../../core/styles/app_colors.dart';
import '../../../core/styles/app_dimensions.dart';
import '../../../core/styles/app_text_styles.dart';
import '../application/caption_studio_controller.dart';
import '../domain/caption_models.dart';

class CaptionStudioScreen extends GetView<CaptionStudioController> {
  const CaptionStudioScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text('AI Social Studio', style: AppTextStyles.sectionTitle.copyWith(fontWeight: FontWeight.w800)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded),
            tooltip: 'Hướng dẫn tạo nội dung',
            onPressed: () => _showGuideDialog(context),
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  AppDimensions.pageHorizontal(constraints.maxWidth),
                  AppDimensions.space16,
                  AppDimensions.pageHorizontal(constraints.maxWidth),
                  AppDimensions.space32,
                ),
                children: [
                  Obx(
                    () => _PhotoDock(
                      images: controller.selectedImages.toList(growable: false),
                      enabled: !controller.isLoading.value && !controller.isPickingImage.value,
                      isPicking: controller.isPickingImage.value,
                      onAddGallery: controller.pickImageFromGallery,
                      onAddCamera: controller.takePhotoWithCamera,
                      onRemoveAt: controller.removeImageAt,
                    ),
                  ),
                  SizedBox(height: AppDimensions.space8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.privacy_tip_outlined, size: AppDimensions.iconSmall, color: scheme.onSurfaceVariant),
                      SizedBox(width: AppDimensions.space8),
                      Expanded(
                        child: Text(
                          'Ảnh được nén trên thiết bị và chỉ gửi tới dịch vụ AI khi bạn bấm tạo nội dung.',
                          style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: AppDimensions.space20),
                  Obx(
                    () => _ToneSelector(selectedTone: controller.selectedTone.value, onSelected: controller.selectTone),
                  ),
                  SizedBox(height: AppDimensions.space16),
                  Obx(
                    () => _PlatformSelector(
                      selectedPlatform: controller.selectedPlatform.value,
                      onSelected: controller.selectPlatform,
                    ),
                  ),
                  SizedBox(height: AppDimensions.space20),
                  Obx(() {
                    final isLoading = controller.isLoading.value;
                    return FilledButton.icon(
                      onPressed: controller.canGenerate ? () => controller.generateCaptions() : null,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(double.infinity, 52),
                        backgroundColor: scheme.secondary,
                        foregroundColor: AppColors.darkInk,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                        elevation: 4,
                      ),
                      icon: isLoading
                          ? SizedBox(
                              width: 20.r,
                              height: 20.r,
                              child: const CircularProgressIndicator(strokeWidth: 2, color: AppColors.darkInk),
                            )
                          : const Icon(Icons.auto_awesome_rounded),
                      label: Text(
                        isLoading ? 'AI đang phân tích ảnh…' : 'Tạo nội dung AI',
                        style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w800),
                      ),
                    );
                  }),
                  Obx(() {
                    final errorMessage = controller.errorMessage.value;
                    if (errorMessage == null) return const SizedBox.shrink();
                    return Padding(
                      padding: EdgeInsets.only(top: AppDimensions.space12),
                      child: Container(
                        padding: EdgeInsets.all(AppDimensions.space12),
                        decoration: BoxDecoration(
                          color: scheme.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppDimensions.radius12),
                          border: Border.all(color: scheme.error.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline_rounded, color: scheme.error, size: 20.sp),
                            SizedBox(width: 8.w),
                            Expanded(
                              child: Text(errorMessage, style: AppTextStyles.caption.copyWith(color: scheme.error)),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  Obx(() {
                    final result = controller.result.value;
                    if (result == null) return const SizedBox.shrink();
                    return Padding(
                      padding: EdgeInsets.only(top: AppDimensions.space28),
                      child: _InstagramMockupCard(controller: controller, result: result),
                    );
                  }),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showGuideDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mẹo tạo nội dung phù hợp'),
        content: const SingleChildScrollView(
          child: Text(
            '1. Chọn ảnh rõ chủ thể và tránh tải ảnh chứa thông tin riêng tư.\n\n'
            '2. Có thể dùng nhiều ảnh cho nội dung so sánh, trước–sau hoặc kể chuyện theo chuỗi.\n\n'
            '3. Chọn đúng giọng điệu và nền tảng để độ dài, hashtag và cách diễn đạt phù hợp hơn.',
          ),
        ),
        actions: [TextButton(onPressed: Get.back, child: const Text('Đã hiểu'))],
      ),
    );
  }
}

class _PhotoDock extends StatelessWidget {
  const _PhotoDock({
    required this.images,
    required this.enabled,
    required this.isPicking,
    required this.onAddGallery,
    required this.onAddCamera,
    required this.onRemoveAt,
  });

  final List<String> images;
  final bool enabled;
  final bool isPicking;
  final VoidCallback onAddGallery;
  final VoidCallback onAddCamera;
  final ValueChanged<int> onRemoveAt;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final canAddImage = enabled && images.length < CaptionStudioController.maximumImages;

    return Container(
      padding: EdgeInsets.all(AppDimensions.space16),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(AppDimensions.radius24),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.6)),
        boxShadow: [BoxShadow(color: scheme.shadow.withValues(alpha: 0.05), blurRadius: 16.r, offset: Offset(0, 4.h))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.photo_library_rounded, color: scheme.primary, size: 20.sp),
                    SizedBox(width: 8.w),
                    Flexible(
                      child: Text('Hình ảnh tải lên', style: AppTextStyles.bodyStrong, overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
              SizedBox(width: 8.w),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(99.r),
                ),
                child: Text(
                  images.length >= 2 ? 'Cặp ảnh Meme' : 'Tối đa 4 ảnh',
                  style: AppTextStyles.caption.copyWith(color: scheme.primary, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          SizedBox(height: AppDimensions.space12),

          if (images.isEmpty)
            InkWell(
              borderRadius: BorderRadius.circular(AppDimensions.radius16),
              onTap: canAddImage ? onAddGallery : null,
              child: Container(
                width: double.infinity,
                constraints: const BoxConstraints(minHeight: 160),
                padding: EdgeInsets.symmetric(vertical: AppDimensions.space16),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(AppDimensions.radius16),
                  border: Border.all(color: scheme.outlineVariant, style: BorderStyle.solid),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: EdgeInsets.all(12.r),
                      decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
                      child: Icon(Icons.add_photo_alternate_rounded, color: scheme.primary, size: 32.sp),
                    ),
                    SizedBox(height: 10.h),
                    Text(isPicking ? 'Đang mở thư viện…' : 'Chạm để chọn ảnh', style: AppTextStyles.bodyStrong),
                    SizedBox(height: 4.h),
                    Text(
                      'Tối đa 4 ảnh cho một lần tạo nội dung',
                      style: AppTextStyles.caption.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            )
          else
            SizedBox(
              height: 160,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: images.length + (images.length < 4 ? 1 : 0),
                separatorBuilder: (context, index) => SizedBox(width: 12.w),
                itemBuilder: (context, index) {
                  if (index == images.length) {
                    return InkWell(
                      borderRadius: BorderRadius.circular(16.r),
                      onTap: canAddImage ? onAddGallery : null,
                      child: Container(
                        width: 110,
                        decoration: BoxDecoration(
                          color: scheme.surfaceContainerHighest.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(16.r),
                          border: Border.all(color: scheme.outlineVariant),
                        ),
                        child: Center(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Padding(
                              padding: EdgeInsets.all(8.r),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add_rounded, color: scheme.primary, size: 28.sp),
                                  SizedBox(height: 4.h),
                                  Text(
                                    '+ Thêm ảnh',
                                    style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }

                  final path = images[index];
                  final cacheWidth = (120 * MediaQuery.devicePixelRatioOf(context)).round();
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16.r),
                        child: Container(
                          width: 120,
                          height: 160,
                          color: Colors.black12,
                          child: Image.file(
                            File(path),
                            fit: BoxFit.cover,
                            cacheWidth: cacheWidth,
                            filterQuality: FilterQuality.low,
                            gaplessPlayback: true,
                            errorBuilder: (context, error, stackTrace) =>
                                const Center(child: Icon(Icons.broken_image_rounded)),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: IconButton(
                          onPressed: enabled ? () => onRemoveAt(index) : null,
                          tooltip: 'Xóa ảnh ${index + 1}',
                          style: IconButton.styleFrom(
                            minimumSize: const Size(AppDimensions.minTouchTarget, AppDimensions.minTouchTarget),
                            backgroundColor: AppColors.black.withValues(alpha: .62),
                            disabledBackgroundColor: AppColors.black.withValues(alpha: .35),
                          ),
                          icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.white),
                        ),
                      ),
                      if (images.length >= 2)
                        Positioned(
                          bottom: 6.h,
                          left: 6.w,
                          child: Container(
                            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                            decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(6.r)),
                            child: Text(
                              index == 0 ? 'Mẫu 1' : 'Mẫu 2',
                              style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          SizedBox(height: AppDimensions.space12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canAddImage ? onAddGallery : null,
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Thư viện'),
                ),
              ),
              SizedBox(width: AppDimensions.space8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canAddImage ? onAddCamera : null,
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const Text('Camera'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToneSelector extends StatelessWidget {
  const _ToneSelector({required this.selectedTone, required this.onSelected});

  final CaptionTone selectedTone;
  final ValueChanged<CaptionTone> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CHỌN TONE GIỌNG',
          style: AppTextStyles.label.copyWith(color: scheme.primary, fontWeight: FontWeight.w800),
        ),
        SizedBox(height: 8.h),
        SizedBox(
          height: 56,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: CaptionTone.values.length,
            separatorBuilder: (context, index) => SizedBox(width: 8.w),
            itemBuilder: (context, index) {
              final tone = CaptionTone.values[index];
              final isSelected = tone == selectedTone;

              return ChoiceChip(
                label: Text(tone.label),
                selected: isSelected,
                selectedColor: scheme.secondary,
                labelStyle: TextStyle(
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected ? AppColors.darkInk : scheme.onSurface,
                  fontSize: 13.sp,
                ),
                backgroundColor: scheme.surface,
                side: BorderSide(color: isSelected ? scheme.secondary : scheme.outlineVariant.withValues(alpha: 0.5)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                onSelected: (_) => onSelected(tone),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _PlatformSelector extends StatelessWidget {
  const _PlatformSelector({required this.selectedPlatform, required this.onSelected});

  final SocialPlatform selectedPlatform;
  final ValueChanged<SocialPlatform> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        Text('Nền tảng:', style: AppTextStyles.bodyStrong),
        SizedBox(width: 12.w),
        Expanded(
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w),
            decoration: BoxDecoration(
              color: scheme.surface,
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.6)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<SocialPlatform>(
                value: selectedPlatform,
                isExpanded: true,
                items: SocialPlatform.values
                    .map(
                      (p) => DropdownMenuItem(
                        value: p,
                        child: Text(
                          p.label,
                          style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (val) {
                  if (val != null) onSelected(val);
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _InstagramMockupCard extends StatelessWidget {
  const _InstagramMockupCard({required this.controller, required this.result});

  final CaptionStudioController controller;
  final CaptionGenerationResult result;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final variant = controller.currentVariant;
    if (variant == null) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(AppDimensions.radius24),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.35)),
        boxShadow: [BoxShadow(color: scheme.primary.withValues(alpha: 0.08), blurRadius: 24.r, offset: Offset(0, 8.h))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: Post mock header
          Padding(
            padding: EdgeInsets.all(AppDimensions.space16),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [scheme.primary, scheme.secondary]),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(child: Icon(Icons.person_rounded, color: AppColors.darkInk, size: 20)),
                ),
                SizedBox(width: 10.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              'snapkit_user',
                              style: AppTextStyles.bodyStrong,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(width: 4.w),
                          Icon(Icons.verified_rounded, size: 14.sp, color: scheme.secondary),
                        ],
                      ),
                      Text(
                        'Mức độ phù hợp: ${variant.viralScore}%',
                        style: AppTextStyles.caption.copyWith(color: scheme.primary, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: AppDimensions.space8, vertical: AppDimensions.space4),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(AppDimensions.radius12),
                  ),
                  child: Text(
                    'Còn ${result.usage.remaining}/${result.usage.limit} lượt',
                    style: AppTextStyles.caption.copyWith(color: scheme.primary, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          // Variants Selector Chips
          Padding(
            padding: EdgeInsets.symmetric(horizontal: AppDimensions.space16),
            child: Row(
              children: List.generate(result.variants.length, (index) {
                final isSelected = controller.activeVariantIndex.value == index;
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: index < result.variants.length - 1 ? 8.w : 0),
                    child: InkWell(
                      onTap: () => controller.selectVariantIndex(index),
                      borderRadius: BorderRadius.circular(10.r),
                      child: AnimatedContainer(
                        duration: MediaQuery.disableAnimationsOf(context)
                            ? Duration.zero
                            : const Duration(milliseconds: 200),
                        padding: EdgeInsets.symmetric(vertical: 6.h),
                        decoration: BoxDecoration(
                          color: isSelected ? scheme.primary : scheme.surfaceContainerHighest.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'Bản ${index + 1}',
                          style: TextStyle(
                            fontSize: 12.sp,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? AppColors.darkInk : scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          SizedBox(height: AppDimensions.space12),

          // Content body
          Padding(
            padding: EdgeInsets.all(AppDimensions.space16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (variant.hookHeadline.isNotEmpty) ...[
                  Text(
                    variant.hookHeadline,
                    style: AppTextStyles.bodyStrong.copyWith(color: scheme.primary, fontSize: 15.sp),
                  ),
                  SizedBox(height: 8.h),
                ],
                SelectableText(variant.body, style: AppTextStyles.body.copyWith(height: 1.45)),
                if (variant.oneLiner.isNotEmpty) ...[
                  SizedBox(height: 12.h),
                  Container(
                    padding: EdgeInsets.all(10.r),
                    decoration: BoxDecoration(
                      color: scheme.surfaceContainerHighest.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(10.r),
                      border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.lightbulb_outline_rounded, size: AppDimensions.iconSmall, color: scheme.secondary),
                        SizedBox(width: AppDimensions.space8),
                        Expanded(
                          child: Text(
                            'One-liner: ${variant.oneLiner}',
                            style: AppTextStyles.caption.copyWith(fontStyle: FontStyle.italic),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (variant.suggestedAudio.isNotEmpty) ...[
                  SizedBox(height: 10.h),
                  Row(
                    children: [
                      Icon(Icons.music_note_rounded, size: 16.sp, color: scheme.secondary),
                      SizedBox(width: 4.w),
                      Expanded(
                        child: Text(
                          'Trending Audio: ${variant.suggestedAudio}',
                          style: AppTextStyles.caption.copyWith(
                            fontWeight: FontWeight.w700,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                SizedBox(height: 12.h),
                // Hashtags
                Text(
                  result.hashtags.asFormattedString,
                  style: TextStyle(color: scheme.primary, fontSize: 13.sp, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),

          // Action Buttons: Copy & Share
          Padding(
            padding: EdgeInsets.fromLTRB(AppDimensions.space16, 0, AppDimensions.space16, AppDimensions.space16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final ok = await controller.copyHashtags();
                      if (ok && context.mounted) {
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(const SnackBar(content: Text('Đã sao chép danh sách Hashtags!')));
                      }
                    },
                    icon: const Icon(Icons.tag_rounded),
                    label: const Text('Copy Tags'),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                    ),
                  ),
                ),
                SizedBox(width: 10.w),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: () async {
                      final ok = await controller.copyCurrentCaption();
                      if (ok && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đã sao chép caption và hashtag.'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      }
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: scheme.primary,
                      foregroundColor: AppColors.darkInk,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                    ),
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Sao chép Caption', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
