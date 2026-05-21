import { ForkRibbon } from './components/ForkRibbon';
import { ImageModalProvider } from './components/ImageModal';
import { Nav } from './components/Nav';
import { ScrollTopButton } from './components/ScrollTopButton';
import { AISection } from './sections/AISection';
import { BuildSection } from './sections/BuildSection';
import { DownloadSection } from './sections/DownloadSection';
import { DualScreens } from './sections/DualScreens';
import { ExportSection } from './sections/ExportSection';
import { Features } from './sections/Features';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { SettingsSection } from './sections/SettingsSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { WebSection } from './sections/WebSection';

export default function App() {
  return (
    <ImageModalProvider>
      <Nav />
      <ForkRibbon />
      <Hero />
      <DualScreens />
      <Features />
      <AISection />
      <SettingsSection />
      <ExportSection />
      <ShortcutsSection />
      <WebSection />
      <DownloadSection />
      <BuildSection />
      <Footer />
      <ScrollTopButton />
    </ImageModalProvider>
  );
}
