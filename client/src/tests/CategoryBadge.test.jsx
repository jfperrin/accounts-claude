import { render, screen } from '@testing-library/react';
import CategoryBadge from '../components/CategoryBadge';

const categories = [
  { _id: 'c1', label: 'Courses', color: '#16a34a' },
];

describe('CategoryBadge', () => {
  it("ne rend rien sans categoryId", () => {
    const { container } = render(
      <CategoryBadge categoryId={null} categories={categories} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rend le label de la catégorie correspondante", () => {
    render(<CategoryBadge categoryId="c1" categories={categories} />);
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });

  it("source manual : pas de bordure pointillée", () => {
    const { container } = render(
      <CategoryBadge categoryId="c1" categories={categories} source="manual" />,
    );
    expect(container.firstChild.className).not.toMatch(/border-dashed/);
  });

  it("source auto : bordure pointillée + aria-label explicite", () => {
    const { container } = render(
      <CategoryBadge categoryId="c1" categories={categories} source="auto" />,
    );
    const badge = container.firstChild;
    expect(badge.className).toMatch(/border border-dashed/);
    expect(badge.getAttribute('aria-label')).toMatch(/suggérée automatiquement/);
    expect(badge.getAttribute('title')).toMatch(/suggérée automatiquement/);
  });
});
