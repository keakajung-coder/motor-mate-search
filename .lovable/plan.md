# Add a form-style A4 PDF export

## What will change
- Keep the existing compact work-order PDF export unchanged.
- Add a second PDF option labeled as the form layout.
- Render the export in the same section order and two-column structure as the Work Order creation form.
- Include technician, vehicle, job metadata, customer/machine, billing, service/work, logistics, and safety information.
- Support both one-order and selected-orders exports.

## Technical details
- Add a reusable print-only work-order form renderer beside the existing creation form.
- Add dedicated A4 export styling with page-break avoidance and compact fixed-width rules.
- Use the existing A4 image-to-PDF scaler so every complete form is auto-fitted to exactly one A4 page.
- Verify type safety, preview build status, and a real exported PDF visually.
