"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Link2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { APPOINTMENT_TYPES, BODIES, FUELS, LEAD_SOURCES, PAYMENT_METHODS, TRANSMISSIONS, localDate, vehicleTitle, type Appointment, type Lead, type Vehicle, type WorkspaceData } from "@/lib/domain";
import { api, errorMessage } from "@/lib/client/api";
import { isOptimizedImage } from "@/lib/images";
import { mutate } from "@/lib/client/workspace";

export type Editor =
  | { kind: "vehicle"; record?: Vehicle }
  | { kind: "lead"; record?: Lead }
  | { kind: "appointment"; record?: Appointment }
  | { kind: "sale"; vehicleId?: string; leadId?: string };

type FieldProps = { label: string; name: string; value?: string | number; type?: string; required?: boolean; min?: string | number; max?: string | number; step?: string | number; placeholder?: string; children?: React.ReactNode };

export function Field({ label, name, value, type = "text", required = true, min, max, step, placeholder, children }: FieldProps) {
  return (
    <label className="form-field">
      <span>{label}{required && <i> *</i>}</span>
      {children
        ? <select name={name} defaultValue={value} required={required}>{children}</select>
        : <input name={name} type={type} defaultValue={value} required={required} min={min} max={max} step={step} placeholder={placeholder} />}
    </label>
  );
}

const options = (values: readonly string[]) => values.map((v) => <option key={v} value={v}>{v}</option>);
const MAX_IMAGES = 12;

function ImageManager({ images, setImages, onError }: { images: string[]; setImages: (images: string[]) => void; onError: (message: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
        const form = new FormData();
        form.append("file", file);
        added.push((await api<{ url: string }>("/api/upload", { form })).url);
      }
      setImages([...images, ...added]);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function addUrl() {
    const value = url.trim();
    if (!/^https:\/\/\S+$/.test(value)) return onError("Image links must start with https://");
    setImages([...images, value]);
    setUrl("");
  }

  return (
    <div className="full-width image-manager">
      <span className="image-manager-label">Photos <small>The first photo is used as the cover image on the website.</small></span>
      <div className="image-strip">
        {images.map((src, index) => (
          <div key={`${src}-${index}`} className="image-thumb">
            <Image src={src} alt={`Vehicle photo ${index + 1}`} fill sizes="120px" unoptimized={!isOptimizedImage(src)} />
            {index === 0 && <span className="cover-tag">Cover</span>}
            <div className="thumb-actions">
              {index > 0 && <button type="button" onClick={() => setImages([src, ...images.filter((_, i) => i !== index)])}>Make cover</button>}
              <button type="button" aria-label="Remove photo" onClick={() => setImages(images.filter((_, i) => i !== index))}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button type="button" className="image-add" disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}<span>{uploading ? "Uploading…" : "Upload"}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => void upload(e.target.files)} />
      <div className="image-url-row">
        <Link2 size={15} />
        <input aria-label="Image URL" placeholder="…or paste an https:// image link" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} />
        <button type="button" className="small-button" onClick={addUrl} disabled={!url.trim()}>Add</button>
      </div>
    </div>
  );
}

export function RecordForm({ editor, data, onClose, onSaved }: { editor: Editor; data: WorkspaceData; onClose: () => void; onSaved: (message: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const vehicle = editor.kind === "vehicle" ? editor.record : undefined;
  const lead = editor.kind === "lead" ? editor.record : undefined;
  const appointment = editor.kind === "appointment" ? editor.record : undefined;
  const record = vehicle ?? lead ?? appointment;
  const [images, setImages] = useState<string[]>(vehicle?.images ?? []);
  const available = data.vehicles.filter((v) => v.status !== "Sold" || v.id === lead?.vehicleId || v.id === appointment?.vehicleId);
  const forSale = data.vehicles.filter((v) => v.status !== "Sold");
  const [saleVehicleId, setSaleVehicleId] = useState(editor.kind === "sale" ? editor.vehicleId ?? forSale[0]?.id ?? "" : "");
  const currency = data.settings.currency;
  const noun = { vehicle: "vehicle", lead: "lead", appointment: "appointment", sale: "a sale" }[editor.kind];
  const title = `${record ? "Edit" : editor.kind === "sale" ? "Record" : "Add"} ${noun}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const checked = (key: string) => form.get(key) === "on";
    setSaving(true);
    setError("");
    try {
      await mutate(async () => {
        if (editor.kind === "vehicle") {
          const body = {
            make: text("make"), model: text("model"), year: text("year"), price: text("price"), mileage: text("mileage"), stock: text("stock"),
            fuel: text("fuel"), transmission: text("transmission"), body: text("body"), color: text("color"), badge: text("badge"),
            status: vehicle?.status === "Sold" ? "Available" : text("status"), description: text("description"), images,
            featured: checked("featured"), published: checked("published"),
          };
          return vehicle ? api(`/api/vehicles/${vehicle.id}`, { method: "PATCH", body }) : api("/api/vehicles", { body });
        }
        if (editor.kind === "lead") {
          const body = { name: text("name"), email: text("email"), phone: text("phone"), source: text("source"), vehicleId: text("vehicleId"), message: text("message") };
          return lead ? api(`/api/leads/${lead.id}`, { method: "PATCH", body }) : api("/api/leads", { body });
        }
        if (editor.kind === "appointment") {
          const body = { customer: text("customer"), email: text("email"), phone: text("phone"), type: text("type"), date: text("date"), time: text("time"), vehicleId: text("vehicleId"), notes: text("notes") };
          return appointment ? api(`/api/appointments/${appointment.id}`, { method: "PATCH", body }) : api("/api/appointments", { body });
        }
        return api("/api/sales", { body: { vehicleId: saleVehicleId, leadId: text("leadId"), amount: text("amount"), date: text("date"), payment: text("payment") } });
      });
      onSaved(editor.kind === "sale" ? "Sale recorded. The vehicle is now marked sold on the website." : `${noun[0].toUpperCase()}${noun.slice(1)} ${record ? "updated" : "added"}.`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const description = {
    vehicle: "Published vehicles appear on your website as soon as you save.",
    lead: "Track a customer and the vehicle they're interested in.",
    appointment: "Appointments created here are confirmed immediately.",
    sale: "Recording a sale marks the vehicle sold and closes the customer's lead as won.",
  }[editor.kind];

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="dealer-dialog record-dialog">
        <DialogTitle className="capitalize">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={submit}>
          <div className="record-fields">
            {editor.kind === "vehicle" && <>
              <Field label="Make" name="make" value={vehicle?.make} placeholder="Toyota" />
              <Field label="Model" name="model" value={vehicle?.model} placeholder="Land Cruiser 300" />
              <Field label="Model year" name="year" type="number" min="1950" max={new Date().getFullYear() + 2} value={vehicle?.year ?? new Date().getFullYear()} />
              <Field label="Stock number" name="stock" value={vehicle?.stock} placeholder="MMC-1042" />
              <Field label={`Asking price (${currency})`} name="price" type="number" min="1" step="0.01" value={vehicle?.price} />
              <Field label="Mileage (km)" name="mileage" type="number" min="0" value={vehicle?.mileage ?? 0} />
              <Field label="Body type" name="body" value={vehicle?.body ?? "SUV"}>{options(BODIES)}</Field>
              <Field label="Fuel type" name="fuel" value={vehicle?.fuel ?? "Petrol"}>{options(FUELS)}</Field>
              <Field label="Transmission" name="transmission" value={vehicle?.transmission ?? "Automatic"}>{options(TRANSMISSIONS)}</Field>
              <Field label="Colour" name="color" value={vehicle?.color} required={false} />
              {vehicle?.status === "Sold"
                ? <label className="form-field"><span>Availability</span><input value="Sold" disabled /></label>
                : <Field label="Availability" name="status" value={vehicle?.status ?? "Available"}>{options(["Available", "Reserved"])}</Field>}
              <Field label="Website badge" name="badge" value={vehicle?.badge} required={false} placeholder="New arrival" />
              <label className="form-field full-width"><span>Description</span><textarea name="description" rows={3} maxLength={3000} defaultValue={vehicle?.description} /></label>
              <ImageManager images={images} setImages={setImages} onError={setError} />
              <label className="check-field"><input type="checkbox" name="published" defaultChecked={vehicle?.published ?? true} /><span><strong>Published</strong><small>Show this vehicle on the website.</small></span></label>
              <label className="check-field"><input type="checkbox" name="featured" defaultChecked={vehicle?.featured ?? false} /><span><strong>Featured</strong><small>Highlight it on the homepage.</small></span></label>
            </>}
            {editor.kind === "lead" && <>
              <Field label="Customer name" name="name" value={lead?.name} />
              <Field label="Email address" name="email" type="email" value={lead?.email} />
              <Field label="Phone number" name="phone" type="tel" value={lead?.phone} required={false} />
              <Field label="Lead source" name="source" value={lead?.source ?? "Walk-in"}>{options(LEAD_SOURCES)}</Field>
              <div className="full-width"><Field label="Vehicle of interest" name="vehicleId" value={lead?.vehicleId ?? ""} required={false}><option value="">General enquiry</option>{available.map((v) => <option key={v.id} value={v.id}>{v.year} {vehicleTitle(v)} ({v.stock})</option>)}</Field></div>
              <label className="form-field full-width"><span>Notes</span><textarea name="message" rows={3} maxLength={3000} defaultValue={lead?.message} /></label>
            </>}
            {editor.kind === "appointment" && <>
              <Field label="Customer name" name="customer" value={appointment?.customer} />
              <Field label="Appointment type" name="type" value={appointment?.type ?? "Test drive"}>{options(APPOINTMENT_TYPES)}</Field>
              <Field label="Email address" name="email" type="email" value={appointment?.email} required={false} />
              <Field label="Phone number" name="phone" type="tel" value={appointment?.phone} required={false} />
              <Field label="Date" name="date" type="date" min={appointment?.date ?? localDate(new Date())} value={appointment?.date ?? localDate(new Date())} />
              <Field label="Time" name="time" type="time" value={appointment?.time ?? "10:00"} />
              <div className="full-width"><Field label="Vehicle" name="vehicleId" value={appointment?.vehicleId ?? ""} required={false}><option value="">No specific vehicle</option>{available.map((v) => <option key={v.id} value={v.id}>{v.year} {vehicleTitle(v)} ({v.stock})</option>)}</Field></div>
              <label className="form-field full-width"><span>Notes</span><textarea name="notes" rows={2} maxLength={1000} defaultValue={appointment?.notes} /></label>
            </>}
            {editor.kind === "sale" && <>
              <label className="form-field"><span>Vehicle<i> *</i></span><select name="vehicleId" required value={saleVehicleId} onChange={(e) => setSaleVehicleId(e.target.value)}><option value="">Select a vehicle</option>{forSale.map((v) => <option key={v.id} value={v.id}>{v.year} {vehicleTitle(v)} ({v.stock})</option>)}</select></label>
              <Field label="Customer" name="leadId" value={editor.leadId ?? ""}><option value="">Select a customer</option>{data.leads.map((l) => <option value={l.id} key={l.id}>{l.name} ({l.email})</option>)}</Field>
              <Field key={saleVehicleId} label={`Sale amount (${currency})`} name="amount" type="number" min="1" step="0.01" value={data.vehicles.find((v) => v.id === saleVehicleId)?.price} />
              <Field label="Sale date" name="date" type="date" max={localDate(new Date())} value={localDate(new Date())} />
              <Field label="Payment method" name="payment" value="Bank transfer">{options(PAYMENT_METHODS)}</Field>
            </>}
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : record ? <Save size={16} /> : <Plus size={16} />}
              {record ? "Save changes" : editor.kind === "sale" ? "Record sale" : `Add ${editor.kind}`}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
