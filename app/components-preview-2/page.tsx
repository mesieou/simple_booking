'use client';
import dynamic from 'next/dynamic';
import React, { useState } from 'react';

// Form
import Select from '@/components/new/form/select';
import RadioGroup from '@/components/new/form/radio-group';
import Textarea from '@/components/new/form/textarea';
import Switch from '@/components/new/form/switch';

// Feedback
import Alert from '@/components/new/feedback/alert';
import Modal from '@/components/new/feedback/modal';
import Progress from '@/components/new/feedback/progress';
import Spinner from '@/components/new/feedback/spinner';

// Navigation
import Tabs from '@/components/new/navigation/tabs';
import Breadcrumbs from '@/components/new/navigation/breadcrumbs';
import Pagination from '@/components/new/navigation/pagination';

// Layout
import Card from '@/components/new/layout/card';
import Container from '@/components/new/layout/container';
import Grid from '@/components/new/layout/grid';
import Divider from '@/components/new/layout/divider';

// Data
import Table from '@/components/new/data/table';
import List from '@/components/new/data/list';
import TreeView from '@/components/new/data/tree-view';

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'orange', label: 'Orange' },
];

const radioOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

type TableRow = { name: string; age: number };
const tableColumns = [
  { key: 'name' as const, header: 'Name' },
  { key: 'age' as const, header: 'Age' },
];
const tableData: TableRow[] = [
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 },
];

const treeData = [
  {
    label: 'Fruits',
    children: [
      { label: 'Apple' },
      { label: 'Banana' },
      { label: 'Orange' },
    ],
  },
  {
    label: 'Vegetables',
    children: [
      { label: 'Carrot' },
      { label: 'Lettuce' },
    ],
  },
];

export default function ComponentsPreview2() {
  const [selectValue, setSelectValue] = useState('apple');
  const [radioValue, setRadioValue] = useState('yes');
  const [switchValue, setSwitchValue] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tabValue, setTabValue] = useState('tab1');
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(60);

  return (
    <Container className="py-8 space-y-12">
      {/* FORM */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Formulario</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-1 font-medium">Select</label>
            <Select options={options} value={selectValue} onChange={setSelectValue} label="Select a fruit" />
          </div>
          <div>
            <label className="block mb-1 font-medium">Radio Group</label>
            <RadioGroup options={radioOptions} value={radioValue} onChange={setRadioValue} name="radio-demo" label="Choose one" />
          </div>
          <div>
            <label className="block mb-1 font-medium">Textarea</label>
            <Textarea label="Message" placeholder="Type something..." />
          </div>
          <div>
            <label className="block mb-1 font-medium">Switch</label>
            <Switch checked={switchValue} onChange={setSwitchValue} label="Enable option" />
          </div>
        </div>
      </section>
      <Divider label="Feedback" />
      {/* FEEDBACK */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Feedback</h2>
        <div className="flex flex-wrap gap-6 items-center">
          <Alert type="info">Esto es una alerta de información.</Alert>
          <Alert type="success">¡Operación exitosa!</Alert>
          <Alert type="warning">Advertencia: revisa los datos.</Alert>
          <Alert type="error">Error: algo salió mal.</Alert>
          <button className="btn" onClick={() => setModalOpen(true)}>Abrir Modal</button>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal de ejemplo">
            <p>Este es el contenido del modal.</p>
            <button className="btn mt-4" onClick={() => setModalOpen(false)}>Cerrar</button>
          </Modal>
          <Progress value={progress} />
          <Spinner />
        </div>
      </section>
      <Divider label="Navegación" />
      {/* NAVIGATION */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Navegación</h2>
        <div className="flex flex-col gap-6">
          <Tabs
            tabs={[
              { label: 'Tab 1', value: 'tab1' },
              { label: 'Tab 2', value: 'tab2' },
              { label: 'Tab 3', value: 'tab3' },
            ]}
            value={tabValue}
            onChange={setTabValue}
          />
          <Breadcrumbs
            crumbs={[
              { label: 'Home', href: '/' },
              { label: 'Section', href: '/section' },
              { label: 'Current' },
            ]}
          />
          <Pagination page={page} totalPages={5} onPageChange={setPage} />
        </div>
      </section>
      <Divider label="Layout" />
      {/* LAYOUT */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Layout</h2>
        <Grid cols={2} gap={6}>
          <Card title="Card 1">Contenido de la tarjeta 1</Card>
          <Card title="Card 2">Contenido de la tarjeta 2</Card>
        </Grid>
      </section>
      <Divider label="Datos" />
      {/* DATA */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Datos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Tabla</h3>
            <Table columns={tableColumns} data={tableData} />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Lista</h3>
            <List items={['Manzana', 'Banana', 'Naranja']} renderItem={item => <span>{item}</span>} />
          </div>
          <div className="md:col-span-2">
            <h3 className="font-semibold mb-2">Tree View</h3>
            <TreeView data={treeData} />
          </div>
        </div>
      </section>
    </Container>
  );
}
