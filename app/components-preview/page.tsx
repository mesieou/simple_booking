"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { ButtonGrid } from "@/components/ui/button-grid"
import { Calendar } from "@/components/ui/calendar"
import { CalendarDay } from "@/components/ui/calendar-day"
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import FileUploader from "@/components/ui/FileUploader"
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator } from "@/components/ui/menubar"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useForm } from "react-hook-form"
import { useToast } from "@/lib/rename-categorise-better/utils/use-toast"

const ColorPalette = () => {
  const colors = [
    { name: "background", variable: "--background" },
    { name: "foreground", variable: "--foreground" },
    { name: "card", variable: "--card" },
    { name: "card-foreground", variable: "--card-foreground" },
    { name: "popover", variable: "--popover" },
    { name: "popover-foreground", variable: "--popover-foreground" },
    { name: "primary", variable: "--primary" },
    { name: "primary-foreground", variable: "--primary-foreground" },
    { name: "secondary", variable: "--secondary" },
    { name: "secondary-foreground", variable: "--secondary-foreground" },
    { name: "muted", variable: "--muted" },
    { name: "muted-foreground", variable: "--muted-foreground" },
    { name: "accent", variable: "--accent" },
    { name: "accent-foreground", variable: "--accent-foreground" },
    { name: "destructive", variable: "--destructive" },
    { name: "destructive-foreground", variable: "--destructive-foreground" },
    { name: "border", variable: "--border" },
    { name: "input", variable: "--input" },
    { name: "ring", variable: "--ring" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
      {colors.map((color) => (
        <Card key={color.name} className="p-4">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-base text-center">{color.variable}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex justify-center">
            <div
              className="h-24 w-24 rounded-full border"
              style={{
                backgroundColor: `hsl(var(${color.variable}))`,
                borderColor: `hsl(var(--border))`,
              }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const TypographyPalette = () => {
  return (
    <div className="space-y-12 text-foreground w-full max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">Primary Font</h2>
        <p className="text-lg text-muted-foreground mb-6">The primary font family used across the application is <strong>Geist Sans</strong>.</p>
        <div className="p-6 border rounded-lg bg-background/50">
          <p className="text-4xl" style={{ fontFamily: 'Geist' }}>Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz</p>
          <p className="text-4xl mt-2" style={{ fontFamily: 'Geist' }}>0123456789</p>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Headings</h2>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">The quick brown fox jumps over the lazy dog. (h1)</h1>
          <h2 className="text-3xl font-semibold tracking-tight">The quick brown fox jumps over the lazy dog. (h2)</h2>
          <h3 className="text-2xl font-semibold tracking-tight">The quick brown fox jumps over the lazy dog. (h3)</h3>
          <h4 className="text-xl font-semibold tracking-tight">The quick brown fox jumps over the lazy dog. (h4)</h4>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Body & Paragraphs</h2>
        <div className="space-y-4">
          <p className="leading-7 [&:not(:first-child)]:mt-6">
            A regular paragraph. The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet,
            consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
            ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <p className="text-sm text-muted-foreground">
            A muted paragraph. The quick brown fox jumps over the lazy dog.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </p>
          <p className="text-lg font-semibold">
            This is a lead paragraph, perfect for intros.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Blockquote</h2>
        <blockquote className="mt-6 border-l-2 pl-6 italic">
          "After all," he said, "everyone enjoys a good joke, so it's only fair that
          they should pay for the privilege."
        </blockquote>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Lists</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold mb-2">Unordered List</h4>
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
              <li>First list item</li>
              <li>Second list item</li>
              <li>Third list item</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Ordered List</h4>
            <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">
              <li>First list item</li>
              <li>Second list item</li>
              <li>Third list item</li>
            </ol>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Inline Elements</h2>
        <p>
          You can use the <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
            inline code
          </code> element for code snippets. Also, here is a <a href="#" className="font-medium text-primary underline underline-offset-4">link</a>.
        </p>
      </div>
    </div>
  )
}

const components = {
  "Theme": [
    {
      title: "Color Palette",
      component: <ColorPalette />,
    },
    {
      title: "Typography",
      component: <TypographyPalette />,
    }
  ],
  "Form Elements": [
    {
      title: "Button",
      component: <div className="flex flex-wrap gap-4">
        <Button variant="default">Default</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon"><span className="sr-only">Icon</span>🔍</Button>
      </div>
    },
    {
      title: "Input",
      component: <Input placeholder="Type something..." />
    },
    {
      title: "Textarea",
      component: <Textarea placeholder="Type your message..." />
    },
    {
      title: "Checkbox",
      component: <div className="flex items-center space-x-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms and conditions</Label>
      </div>
    },
    {
      title: "Radio Group",
      component: <RadioGroup defaultValue="option-1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option-1" id="option-1" />
          <Label htmlFor="option-1">Option 1</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option-2" id="option-2" />
          <Label htmlFor="option-2">Option 2</Label>
        </div>
      </RadioGroup>
    },
    {
      title: "Switch",
      component: <div className="flex items-center space-x-2">
        <Switch id="airplane-mode" />
        <Label htmlFor="airplane-mode">Airplane Mode</Label>
      </div>
    },
    {
      title: "Select",
      component: <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
          <SelectItem value="option3">Option 3</SelectItem>
        </SelectContent>
      </Select>
    }
  ],
  "Layout": [
    {
      title: "Card",
      component: <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card Content</p>
        </CardContent>
        <CardFooter>
          <p>Card Footer</p>
        </CardFooter>
      </Card>
    },
    {
      title: "Accordion",
      component: <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    },
    {
      title: "Aspect Ratio",
      component: <AspectRatio ratio={16 / 9}>
        <div className="w-full h-full bg-muted rounded-md" />
      </AspectRatio>
    },
    {
      title: "Avatar",
      component: <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    },
    {
      title: "Badge",
      component: <div className="flex gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    },
    {
      title: "Breadcrumb",
      component: <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/components">Components</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    },
    {
      title: "Button Grid",
      component: <ButtonGrid 
        items={[
          { id: 1, label: "Button 1" },
          { id: 2, label: "Button 2" },
          { id: 3, label: "Button 3" },
          { id: 4, label: "Button 4" }
        ]}
        columns={2}
      />
    },
    {
      title: "Calendar",
      component: <CalendarDemo />
    },
    {
      title: "Calendar Day",
      component: <CalendarDay 
        date={new Date()} 
        onSelect={() => {}} 
        isSelected={false} 
      />
    },
    {
      title: "Carousel",
      component: <div className="space-y-8">
        <div>
          <h4 className="text-sm font-medium mb-2">Horizontal Carousel</h4>
          <Carousel>
            <CarouselContent>
              {Array.from({ length: 5 }).map((_, i) => (
                <CarouselItem key={i}>
                  <div className="p-1">
                    <Card>
                      <CardContent className="flex aspect-square items-center justify-center p-6">
                        <span className="text-4xl font-semibold">{i + 1}</span>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Vertical Carousel</h4>
          <Carousel
            opts={{ align: "start" }}
            orientation="vertical"
            className="w-full max-w-xs"
          >
            <CarouselContent className="-mt-1 h-[200px]">
              {Array.from({ length: 5 }).map((_, index) => (
                <CarouselItem key={index} className="pt-1 h-full">
                  <div className="p-1 h-full">
                    <Card className="h-full flex items-center justify-center">
                      <CardContent className="flex items-center justify-center h-full">
                        <span className="text-3xl font-semibold">{index + 1}</span>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Auto-playing Carousel</h4>
          <Carousel opts={{ loop: true, align: "start" }}>
            <CarouselContent>
              {Array.from({ length: 5 }).map((_, i) => (
                <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3">
                  <div className="p-1">
                    <Card>
                      <CardContent className="flex aspect-square items-center justify-center p-6">
                        <span className="text-4xl font-semibold">{i + 1}</span>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </div>
    },
    {
      title: "Command",
      component: <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
            <CommandItem>Search</CommandItem>
            <CommandItem>Settings</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    },
    {
      title: "File Uploader",
      component: <FileUploader onFileUpload={() => {}} />
    },
    {
      title: "Menubar",
      component: <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New Tab</MenubarItem>
            <MenubarItem>New Window</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Share</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    },
    {
      title: "Popover",
      component: <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Place content for the popover here.</PopoverContent>
      </Popover>
    },
    {
      title: "Progress",
      component: <Progress value={33} />
    },
    {
      title: "Resizable",
      component: (
        <ResizablePanelGroup
          direction="horizontal"
          className="max-w-md rounded-lg border md:min-w-[450px]"
        >
          <ResizablePanel defaultSize={50}>
            <div className="flex h-[200px] items-center justify-center p-6">
              <span className="font-semibold">One</span>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50}>
            <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={25}>
          <div className="flex h-full items-center justify-center p-6">
                  <span className="font-semibold">Two</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={75}>
          <div className="flex h-full items-center justify-center p-6">
                  <span className="font-semibold">Three</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      ),
    },
    {
      title: "Scroll Area",
      component: <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
        <div className="space-y-4">
          <h4 className="text-sm font-medium leading-none">Tags</h4>
          <div className="text-sm">
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={i} className="mb-2">Scroll Item {i + 1}</div>
            ))}
          </div>
        </div>
      </ScrollArea>
    },
    {
      title: "Separator",
      component: <div className="space-y-4">
        <div>Above</div>
        <Separator />
        <div>Below</div>
      </div>
    },
    {
      title: "Sheet",
      component: <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet Description</SheetDescription>
          </SheetHeader>
          <div className="py-4">Sheet Content</div>
          <SheetFooter>
            <SheetClose>Close</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    },
    {
      title: "Skeleton",
      component: <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    },
    {
      title: "Slider",
      component: <Slider defaultValue={[33]} max={100} step={1} />
    },
    {
      title: "Table",
      component: <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John Doe</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Jane Smith</TableCell>
              <TableCell>Inactive</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    },
    {
      title: "Tabs",
      component: <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          Account settings
        </TabsContent>
        <TabsContent value="password">
          Password settings
        </TabsContent>
      </Tabs>
    },
    {
      title: "Tooltip",
      component: <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>
            <p>Tooltip content</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    }
  ]
}

export default function Page() {
  const { toast } = useToast()
  const [selectedComponent, setSelectedComponent] = useState<{
    title: string;
    component: React.ReactNode;
  } | null>(null)

  const componentsWithToast = {
    ...components,
    Layout: components.Layout.map(item =>
      item.title === "Toast"
        ? {
            ...item,
            component: (
              <Button
                onClick={() => {
                  toast({
                    title: "Scheduled: Catch up",
                    description: "Friday, February 10, 2023 at 5:57 PM",
                  })
                }}
              >
                Show Toast
              </Button>
            ),
          }
        : item
    ),
  }

  const form = useForm({
    defaultValues: {
      email: "",
    },
  })

  return (
    <SidebarProvider>
      <AppSidebar>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">UI Components</h2>
          {Object.entries(componentsWithToast).map(([category, items]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium mb-2">{category}</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => setSelectedComponent(item)}
                    className={`w-full text-left p-2 rounded-md ${
                      selectedComponent?.title === item.title
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AppSidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    UI Components
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{selectedComponent?.title || "Select a component"}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-4rem)] p-8">
          {selectedComponent ? (
            <div className="w-full max-w-6xl flex items-center justify-center rounded-lg p-8 border border-white/10">
              {selectedComponent.component}
            </div>
          ) : (
            <div className="text-muted-foreground rounded-lg p-8 border border-white/10">
              Select a component from the sidebar to preview it
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function CalendarDemo() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border shadow-sm"
      captionLayout="dropdown"
    />
  )
}
