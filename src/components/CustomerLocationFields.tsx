import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerLocation, type CustomerLocation } from "@/lib/customer-location";

export function CustomerLocationFields({ value, onChange, disabled = false }: {
  value?: CustomerLocation | null;
  onChange: (value: CustomerLocation) => void;
  disabled?: boolean;
}) {
  const location = customerLocation(value);
  return <div className="grid min-w-0 grid-cols-1 gap-3 lg:col-span-2 lg:grid-cols-2">
    {([['subdistrict', 'ตำบล / แขวง'], ['district', 'อำเภอ / เขต'], ['province', 'จังหวัด'], ['postal_code', 'รหัสไปรษณีย์'], ['latitude', 'ละติจูด (Lat)'], ['longitude', 'ลองจิจูด (Long)'], ['maps_url', 'ลิงก์ Google Maps']] as const).map(([key, label]) => (
      <div key={key} className="min-w-0 space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input aria-label={label} disabled={disabled} value={location[key] ?? ""}
          type={key === 'latitude' || key === 'longitude' ? 'number' : 'text'} step="any"
          onChange={e => onChange({ ...location, [key]: key === 'latitude' || key === 'longitude' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value })} />
      </div>
    ))}
  </div>;
}