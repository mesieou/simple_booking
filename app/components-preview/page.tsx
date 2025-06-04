"use client";

// UI Components
import { Button, buttonVariants } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { ButtonGrid } from "@components/ui/button-grid";
import { Checkbox } from "@components/ui/checkbox";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { CalendarDay } from "@components/ui/calendar-day";
import FileUploader from "@components/ui/FileUploader";
// Other UI: dropdown-menu, toast, toaster, etc. (not shown visually here due to being utilities or require context)

// Form Components
import { FormMessage } from "@components/form/form-message";
import { FormError } from "@components/form/form-error";
import { SubmitButton } from "@components/form/submit-button";
import Precios from "@components/form/products/products";
import Direction from "@components/form/locations/direction";
import Distance from "@components/form/locations/distance";
import Calendar from "@components/form/datetime-picker/calendar";
import Hour from "@components/form/datetime-picker/hour";

// Layout Components
import Menu from "@components/layout/menu";
import { Footer } from "@components/layout/footer";
import HeaderAuth from "@components/layout/header-auth";
import LanguageSwitcher from "@components/layout/language-switcher";
import { ThemeSwitcher } from "@components/layout/theme-switcher";

// Misc Components
import { EnvVarWarning } from "@components/misc/env-var-warning";
import NextLogo from "@components/misc/next-logo";
import SupabaseLogo from "@components/misc/supabase-logo";
import DeployButton from "@components/misc/deploy-button";

// Sections
import About from "@components/sections/about";
import Features_App from "@components/sections/features";
import BookingSummary from "@components/sections/BookingSummary";
import Hero from "@components/sections/hero";
import JoinWaitlist from "@components/sections/waitlist-form";

// Typography
import { TypographyInlineCode } from "@components/typography/inline-code";

// Weekly Hours
import { WeeklyHours, DayAvailabilityRow, TimeRangeInput, TimeZoneSelector } from "@components/weekly-hours";

import { FormProvider } from "@/lib/rename-categorise-better/utils/FormContext";

export default function ComponentsPreviewPage() {
  // Fake data
  const fakeDate = new Date();
  const fakeProviderId = "provider123";
  const fakeSize = "one";
  const fakeOnSelect = (date: Date, time?: string) => {};
  const fakeOnTimeSelect = (time: string) => {};
  const fakeOnFileUpload = (file: File) => {};
  const fakeMessage = { success: "This is a success message!" };
  const fakeRanges = [{ start: "09:00", end: "17:00" }];

  return (
    <div className="space-y-16 p-8 min-h-screen">
      {/* UI Components */}
      <section>
        <h2 className="text-2xl font-bold mb-4">UI Components</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button>Default Button</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Badge>Default Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Checkbox />
          <Input placeholder="Input example" />
          <Label htmlFor="input-example">Label Example</Label>
          <ButtonGrid items={[{ id: 1, label: "A" }, { id: 2, label: "B" }]} />
          <CalendarDay date={fakeDate} onSelect={() => {}} isSelected={false} />
          <FileUploader onFileUpload={fakeOnFileUpload} />
        </div>
      </section>

      {/* Form Components */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Form Components</h2>
        <FormProvider>
          <div className="space-y-4">
            <FormMessage message={fakeMessage} />
            <FormError />
            <SubmitButton>Submit</SubmitButton>
            <Precios base={100} labor_min={2} />
            <Direction texto="Address" value="Fake Street 123" onChange={() => {}} />
            <Distance onChange={() => {}} onContinue={() => {}} />
            <Calendar providerId={fakeProviderId} size={fakeSize as any} onSelect={fakeOnSelect} />
            <Hour providerId={fakeProviderId} date={fakeDate} size={fakeSize as any} onTimeSelect={fakeOnTimeSelect} />
          </div>
        </FormProvider>
      </section>

      {/* Layout Components */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Layout Components</h2>
        <div className="space-y-2">
          <Menu />
          <Footer />
          <HeaderAuth />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </section>

      {/* Misc Components */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Misc Components</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <EnvVarWarning />
          <NextLogo />
          <SupabaseLogo />
          <DeployButton />
        </div>
      </section>

      {/* Sections */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Sections</h2>
        <div className="space-y-4">
          <About />
          <Features_App />
          <BookingSummary
            origen="Origin"
            origenDireccion="Origin Address"
            destino="Destination"
            destinoDireccion="Destination Address"
            vehiculo="Truck"
            luggers={2}
            precioBase={100}
            precioPorMinuto={2}
            arrivalWindow="10:00 - 12:00"
            moving="Boxes, furniture, etc."
          />
          <Hero />
          <JoinWaitlist />
        </div>
      </section>

      {/* Typography */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Typography</h2>
        <TypographyInlineCode />
      </section>

      {/* Weekly Hours */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Weekly Hours</h2>
        <WeeklyHours />
        <DayAvailabilityRow
          day="Monday"
          available={true}
          ranges={fakeRanges}
          onToggleAvailable={() => {}}
          onChangeRange={() => {}}
          onAddRange={() => {}}
          onRemoveRange={() => {}}
          onDuplicateRange={() => {}}
        />
        <TimeRangeInput range={fakeRanges[0]} onChange={() => {}} index={0} />
        <TimeZoneSelector value="America/New_York" onChange={() => {}} />
      </section>
    </div>
  );
}
