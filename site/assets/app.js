const elements = {
  breadcrumb: document.querySelector('#breadcrumb'),
  content: document.querySelector('#content'),
  documentation: document.querySelector('#documentation'),
  error: document.querySelector('#error-state'),
  familyList: document.querySelector('#family-list'),
  footerVersion: document.querySelector('#footer-version'),
  loading: document.querySelector('#loading-state'),
  navPanel: document.querySelector('.nav-panel'),
  navToggle: document.querySelector('#nav-toggle'),
  navVersion: document.querySelector('#nav-version'),
  search: document.querySelector('#family-search'),
  serverFilter: document.querySelector('#server-filter')
};

let commands = [];
let automaticFeatures = [];
let documentationVersion = '';
let serverAliases = new Map();

if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

function element(tagName, attributes = {}, text = null) {
  const node = document.createElement(tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    if (name === 'className') node.className = value;
    else node.setAttribute(name, value);
  });
  if (text !== null) node.textContent = text;
  return node;
}

function familyUrl(path) {
  const url = new URL(window.location.href);
  const serverKey = elements.serverFilter.value;
  url.search = '';
  url.hash = '';
  url.searchParams.set('family', path);
  if (serverKey) url.searchParams.set('server', serverKey);
  return `${url.pathname}${url.search}`;
}

function featureUrl(key) {
  const url = new URL(window.location.href);
  const serverKey = elements.serverFilter.value;
  url.search = '';
  url.hash = '';
  url.searchParams.set('feature', key);
  if (serverKey) url.searchParams.set('server', serverKey);
  return `${url.pathname}${url.search}`;
}

function indexUrl() {
  const url = new URL(window.location.href);
  const serverKey = elements.serverFilter.value;
  url.search = '';
  url.hash = '';
  if (serverKey) url.searchParams.set('server', serverKey);
  return `${url.pathname}${url.search}`;
}

function selectedFamilyPath() {
  return new URLSearchParams(window.location.search).get('family');
}

function selectedFeatureKey() {
  return new URLSearchParams(window.location.search).get('feature');
}

function selectedServerKey() {
  return new URLSearchParams(window.location.search).get('server');
}

function commandMatchesServer(command, serverKey = elements.serverFilter.value) {
  if (!serverKey) return true;
  return command.server_keys.includes(serverKey) || command.server_keys.includes('all-installed-servers');
}

function featureMatchesServer(feature, serverKey = elements.serverFilter.value) {
  if (!serverKey) return true;
  return feature.server_keys.includes(serverKey) || feature.server_keys.includes('all-installed-servers');
}

function commandAnchor(path) {
  return `method-${path.replaceAll('/', '-').replaceAll(' ', '-').toLowerCase()}`;
}

function serverPills(command) {
  const pills = element('div', { className: 'server-pills', 'aria-label': 'Available servers' });
  command.server_keys.forEach((key) => {
    const server = serverAliases.get(key);
    if (!server) return;

    const pill = element('span', { className: 'server-pill' });
    pill.append(
      element('img', { src: server.icon, alt: '', width: '22', height: '22', loading: 'lazy', 'aria-hidden': 'true' }),
      element('span', {}, server.alias)
    );
    pills.append(pill);
  });
  return pills;
}

function signature(command) {
  const parameters = command.options.map((option) => {
    const marker = option.required ? option.name : `${option.name} = optional`;
    return marker;
  });
  return `${command.name}${parameters.length ? `(${parameters.join(', ')})` : ''}`;
}

function optionConstraint(option) {
  const details = [];
  if (option.choices?.length) details.push(`choices: ${option.choices.map((choice) => choice.name).join(', ')}`);
  if (option.min_value !== undefined) details.push(`minimum: ${option.min_value}`);
  if (option.max_value !== undefined) details.push(`maximum: ${option.max_value}`);
  if (option.min_length !== undefined) details.push(`minimum length: ${option.min_length}`);
  if (option.max_length !== undefined) details.push(`maximum length: ${option.max_length}`);
  return details.join('; ');
}

function tagList(command) {
  const tags = element('div', { className: 'tags' });
  tags.append(element('p', { className: 'tag-title' }, 'Permission:'));
  const permissionList = element('ul');
  const permission = element('li');
  permission.append(element('code', {}, command.permission), document.createTextNode(' — required local access level'));
  permissionList.append(permission);
  tags.append(permissionList);

  tags.append(element('p', { className: 'tag-title' }, 'Availability:'));
  const availabilityList = element('ul');
  availabilityList.append(element('li', {}, command.availability));
  tags.append(availabilityList);
  return tags;
}

function parameterList(command) {
  if (!command.options.length) return null;

  const parameters = element('div', { className: 'tags' });
  parameters.append(element('p', { className: 'tag-title' }, 'Parameters:'));
  const list = element('ul', { className: 'parameter-list' });
  command.options.forEach((option) => {
    const item = element('li');
    const heading = element('div', { className: 'parameter-heading' });
    heading.append(element('span', { className: 'parameter-name' }, option.name));
    heading.append(element('span', { className: 'parameter-type' }, `(${option.type})`));
    if (!option.required) heading.append(element('em', {}, 'optional'));
    item.append(heading, element('p', {}, option.description));

    const constraint = optionConstraint(option);
    if (constraint) item.append(element('p', { className: 'constraint' }, constraint));
    list.append(item);
  });
  parameters.append(list);
  return parameters;
}

function methodDetail(command) {
  const section = element('section', { className: 'method-detail', id: commandAnchor(command.path) });
  const heading = element('h3', { className: 'signature' });
  heading.append(document.createTextNode('# '), element('strong', {}, signature(command)));
  section.append(heading);

  const discussion = element('div', { className: 'discussion' });
  discussion.append(element('p', {}, command.description));
  if (command.details) discussion.append(element('p', {}, command.details));
  section.append(discussion, tagList(command));

  const parameters = parameterList(command);
  if (parameters) section.append(parameters);
  return section;
}

function summaryTable(commandsToSummarize) {
  const table = element('table', { className: 'summary-table' });
  const body = element('tbody');
  commandsToSummarize.forEach((command) => {
    const row = element('tr');
    const signatureCell = element('td', { className: 'summary-signature' });
    signatureCell.append(
      element(
        'a',
        { href: `#${commandAnchor(command.path)}`, 'data-documentation-route': '' },
        signature(command)
      )
    );
    row.append(signatureCell, element('td', {}, command.description));
    body.append(row);
  });
  table.append(body);
  return table;
}

function sectionHeading(text) {
  return element('h2', { className: 'section-title' }, text);
}

function renderFamily(command) {
  const objectKind = command.type === 'chat_input' ? 'Command family' : 'App interaction';
  document.title = `${command.name} · Ulfgar Bot Reference`;
  elements.breadcrumb.replaceChildren(
    element('a', { href: indexUrl(), 'data-documentation-route': '' }, 'Index'),
    document.createTextNode(' » '),
    element('span', {}, `${objectKind}: ${command.name}`)
  );

  const header = element('header', { className: 'object-header' });
  header.append(element('p', { className: 'object-kind' }, objectKind));
  header.append(element('h1', {}, command.name));
  header.append(element('p', { className: 'defined-in' }, `${command.category} · ${command.availability}`));
  header.append(serverPills(command));

  const overview = element('section', { className: 'doc-section' });
  overview.append(sectionHeading('Overview'), element('p', {}, command.description));
  if (command.details) overview.append(element('p', {}, command.details));
  overview.append(tagList(command));

  const documentedCommands = command.subcommands.length ? command.subcommands : [command];
  const label = command.subcommands.length ? 'Subcommand' : 'Command';
  const summary = element('section', { className: 'doc-section' });
  summary.append(sectionHeading(`${label} Summary`), summaryTable(documentedCommands));

  const details = element('section', { className: 'doc-section' });
  details.append(sectionHeading(`${label} Details`));
  documentedCommands.forEach((subcommand) => details.append(methodDetail(subcommand)));

  elements.documentation.replaceChildren(header, overview, summary, details);
}

function renderFeature(feature) {
  document.title = `${feature.name} · Ulfgar Bot Reference`;
  elements.breadcrumb.replaceChildren(
    element('a', { href: indexUrl(), 'data-documentation-route': '' }, 'Index'),
    document.createTextNode(' » '),
    element('span', {}, `Automatic feature: ${feature.name}`)
  );

  const header = element('header', { className: 'object-header' });
  header.append(element('p', { className: 'object-kind' }, 'Automatic feature'));
  header.append(element('h1', {}, feature.name));
  header.append(element('p', { className: 'defined-in' }, `${feature.category} · ${feature.availability}`));
  header.append(serverPills(feature));

  const overview = element('section', { className: 'doc-section' });
  overview.append(sectionHeading('Overview'), element('p', {}, feature.description));

  const behavior = element('section', { className: 'doc-section' });
  behavior.append(sectionHeading('What to expect'), element('p', {}, feature.details));

  elements.documentation.replaceChildren(header, overview, behavior);
}

function commandGroups() {
  const alphabetically = (left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  return {
    appInteractions: commands
      .filter((command) => command.type !== 'chat_input' && commandMatchesServer(command))
      .sort(alphabetically),
    commandFamilies: commands
      .filter((command) => command.type === 'chat_input' && commandMatchesServer(command))
  };
}

function familyCards(group) {
  const index = element('div', { className: 'family-index' });
  group.forEach((command) => {
    const card = element('article', { className: 'family-index-item' });
    const heading = element('h3');
    const commandCount = command.subcommands.length || 1;
    heading.append(element('a', { href: familyUrl(command.path), 'data-documentation-route': '' }, command.name));
    card.append(heading, element('p', {}, command.description));
    card.append(serverPills(command));
    card.append(element('small', {}, `${commandCount} documented command${commandCount === 1 ? '' : 's'}`));
    index.append(card);
  });
  return index;
}

function renderIndex() {
  document.title = 'Ulfgar Bot Reference';
  elements.breadcrumb.replaceChildren(element('span', {}, 'Reference Index'));

  const header = element('header', { className: 'object-header' });
  header.append(element('p', { className: 'object-kind' }, 'Reference index'));
  header.append(element('h1', {}, 'Ulfgar Bot Reference'));
  const selectedServer = serverAliases.get(elements.serverFilter.value);
  const indexContext = selectedServer ? `${documentationVersion} · Available on ${selectedServer.alias}` : documentationVersion;
  header.append(element('p', { className: 'defined-in' }, indexContext));

  const { appInteractions, commandFamilies } = commandGroups();
  const interactionSection = element('section', { className: 'doc-section prose' });
  interactionSection.append(
    sectionHeading('App Interactions'),
    element('p', {}, 'Actions available from Discord’s Apps context menu. Future message and user interactions will appear here automatically.'),
    familyCards(appInteractions)
  );

  const commandSection = element('section', { className: 'doc-section prose' });
  commandSection.append(
    sectionHeading('Command Families'),
    element('p', {}, 'Each family groups related slash commands. Choose a family to see its subcommands, permissions, options, choices, and limits.'),
    familyCards(commandFamilies)
  );

  const matchingFeatures = automaticFeatures.filter((feature) => featureMatchesServer(feature));
  const featureSection = element('section', { className: 'doc-section prose' });
  featureSection.append(
    sectionHeading('Automatic Features'),
    element('p', {}, 'These features respond to messages, publish scheduled posts, or maintain community information without requiring a slash command.'),
    featureCards(matchingFeatures)
  );
  elements.documentation.replaceChildren(header, interactionSection, commandSection, featureSection);
}

function featureCards(features) {
  const index = element('div', { className: 'family-index' });
  features.forEach((feature) => {
    const card = element('article', { className: 'family-index-item' });
    const heading = element('h3');
    heading.append(element('a', { href: featureUrl(feature.key), 'data-documentation-route': '' }, feature.name));
    card.append(heading, element('p', {}, feature.description));
    card.append(serverPills(feature));
    card.append(element('small', {}, feature.category));
    index.append(card);
  });
  return index;
}

function appendNavigationGroup(title, group, normalizedQuery, selected) {
  const matchingCommands = group.filter((command) => {
    const searchable = [command.name, command.category, command.description, ...command.subcommands.map((item) => item.name)]
      .join(' ').toLowerCase();
    return !normalizedQuery || searchable.includes(normalizedQuery);
  });
  if (!matchingCommands.length) return;

  elements.familyList.append(element('li', { className: 'nav-group-title' }, title));
  matchingCommands.forEach((command) => {
    const item = element('li');
    const link = element('a', { href: familyUrl(command.path), 'data-documentation-route': '' });
    if (command.path === selected) link.setAttribute('aria-current', 'page');
    link.append(element('span', { className: 'family-name' }, command.name));
    link.append(element('small', {}, command.category));
    item.append(link);

    if (command.subcommands.length) {
      const children = element('ul', { className: 'subcommand-list' });
      command.subcommands.forEach((subcommand) => {
        const child = element('li');
        child.append(
          element(
            'a',
            { href: `${familyUrl(command.path)}#${commandAnchor(subcommand.path)}`, 'data-documentation-route': '' },
            subcommand.name
          )
        );
        children.append(child);
      });
      item.append(children);
    }
    elements.familyList.append(item);
  });
}

function appendFeatureNavigation(normalizedQuery, selected) {
  const matchingFeatures = automaticFeatures.filter((feature) => {
    const searchable = [feature.name, feature.category, feature.description, feature.details].join(' ').toLowerCase();
    return featureMatchesServer(feature) && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
  if (!matchingFeatures.length) return;

  elements.familyList.append(element('li', { className: 'nav-group-title' }, 'Automatic features'));
  matchingFeatures.forEach((feature) => {
    const item = element('li');
    const link = element('a', { href: featureUrl(feature.key), 'data-documentation-route': '' });
    if (feature.key === selected) link.setAttribute('aria-current', 'page');
    link.append(element('span', { className: 'family-name' }, feature.name));
    link.append(element('small', {}, feature.category));
    item.append(link);
    elements.familyList.append(item);
  });
}

function populateServerFilter() {
  const selected = selectedServerKey();
  [...serverAliases.values()]
    .filter((server) => server.key !== 'all-installed-servers')
    .sort((left, right) => left.alias.localeCompare(right.alias, undefined, { sensitivity: 'base' }))
    .forEach((server) => {
      const option = element('option', { value: server.key }, server.alias);
      elements.serverFilter.append(option);
    });
  if (serverAliases.has(selected) && selected !== 'all-installed-servers') elements.serverFilter.value = selected;
}

function renderNavigation(query = '') {
  const selectedFamily = selectedFamilyPath();
  const selectedFeature = selectedFeatureKey();
  const normalizedQuery = query.trim().toLowerCase();
  elements.familyList.replaceChildren();
  const { appInteractions, commandFamilies } = commandGroups();
  appendNavigationGroup('App interactions', appInteractions, normalizedQuery, selectedFamily);
  appendNavigationGroup('Command families', commandFamilies, normalizedQuery, selectedFamily);
  appendFeatureNavigation(normalizedQuery, selectedFeature);
}

function renderNavigationAtCurrentScroll(query = elements.search.value) {
  const scrollTop = elements.navPanel.scrollTop;
  renderNavigation(query);
  elements.navPanel.scrollTop = scrollTop;
}

function renderCurrentRoute() {
  const selected = selectedFamilyPath();
  const command = commands.find((candidate) => candidate.path === selected);
  if (selected && !command) throw new Error(`unknown command family: ${selected}`);

  const selectedFeature = selectedFeatureKey();
  const feature = automaticFeatures.find((candidate) => candidate.key === selectedFeature);
  if (selectedFeature && !feature) throw new Error(`unknown automatic feature: ${selectedFeature}`);
  if (command && feature) throw new Error('select either a command family or an automatic feature');

  if (command && commandMatchesServer(command)) renderFamily(command);
  else if (feature && featureMatchesServer(feature)) renderFeature(feature);
  else {
    if (command || feature) {
      const url = new URL(window.location.href);
      url.searchParams.delete('family');
      url.searchParams.delete('feature');
      url.hash = '';
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    }
    renderIndex();
  }
}

function scrollToRouteTarget(scrollTop = 0) {
  const anchor = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
  if (anchor) anchor.scrollIntoView();
  else window.scrollTo({ top: scrollTop, left: 0, behavior: 'auto' });
}

function routeState(documentScrollTop = window.scrollY) {
  return {
    documentScrollTop,
    navigationScrollTop: elements.navPanel.scrollTop
  };
}

function navigateWithinDocumentation(target) {
  window.history.replaceState(routeState(), '', window.location.href);
  const nextState = routeState(0);
  window.history.pushState(nextState, '', target);
  renderCurrentRoute();
  renderNavigationAtCurrentScroll();
  elements.navPanel.scrollTop = nextState.navigationScrollTop;
  elements.content.focus({ preventScroll: true });
  scrollToRouteTarget();
  closeNavigation();
}

function closeNavigation() {
  elements.navPanel.classList.remove('nav-panel--open');
  elements.navToggle.setAttribute('aria-expanded', 'false');
}

async function loadDocumentation() {
  try {
    const [commandResponse, featureResponse] = await Promise.all([
      fetch('data/commands.json'),
      fetch('data/features.json')
    ]);
    if (!commandResponse.ok) throw new Error(`command data returned ${commandResponse.status}`);
    if (!featureResponse.ok) throw new Error(`automatic-feature data returned ${featureResponse.status}`);
    const [data, featureData] = await Promise.all([commandResponse.json(), featureResponse.json()]);
    if (data.schema_version !== 1 || !Array.isArray(data.commands) || !Array.isArray(data.server_aliases)) {
      throw new Error('unsupported command data');
    }
    if (featureData.schema_version !== 1 || !Array.isArray(featureData.features)) {
      throw new Error('unsupported automatic-feature data');
    }
    if (featureData.generated_from !== data.generated_from) throw new Error('documentation versions do not match');

    commands = data.commands;
    automaticFeatures = featureData.features;
    serverAliases = new Map(data.server_aliases.map((server) => [server.key, server]));
    populateServerFilter();
    documentationVersion = data.generated_from;
    elements.navVersion.textContent = documentationVersion;
    elements.footerVersion.textContent = `Ulfgar Bot documentation · ${documentationVersion}`;
    renderNavigation();

    renderCurrentRoute();
    window.history.replaceState(routeState(), '', window.location.href);

    elements.loading.hidden = true;
    elements.documentation.hidden = false;
    requestAnimationFrame(() => scrollToRouteTarget(window.history.state?.documentScrollTop || 0));
  } catch (error) {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
  } finally {
    elements.familyList.setAttribute('aria-busy', 'false');
  }
}

elements.search.addEventListener('input', (event) => renderNavigationAtCurrentScroll(event.target.value));
elements.serverFilter.addEventListener('change', () => {
  const url = new URL(window.location.href);
  if (elements.serverFilter.value) url.searchParams.set('server', elements.serverFilter.value);
  else url.searchParams.delete('server');

  const selectedCommand = commands.find((command) => command.path === selectedFamilyPath());
  const selectedFeature = automaticFeatures.find((feature) => feature.key === selectedFeatureKey());
  if (selectedCommand && commandMatchesServer(selectedCommand)) renderFamily(selectedCommand);
  else if (selectedFeature && featureMatchesServer(selectedFeature)) renderFeature(selectedFeature);
  else {
    url.searchParams.delete('family');
    url.searchParams.delete('feature');
    url.hash = '';
    renderIndex();
  }
  window.history.replaceState(routeState(), '', `${url.pathname}${url.search}${url.hash}`);
  renderNavigationAtCurrentScroll();
});
elements.navToggle.addEventListener('click', () => {
  const open = elements.navPanel.classList.toggle('nav-panel--open');
  elements.navToggle.setAttribute('aria-expanded', open.toString());
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNavigation();
});
document.addEventListener('click', (event) => {
  const link = event.target.closest?.('a[data-documentation-route]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const target = new URL(link.href);
  if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return;

  event.preventDefault();
  navigateWithinDocumentation(target);
});
window.addEventListener('popstate', (event) => {
  renderCurrentRoute();
  renderNavigationAtCurrentScroll();
  elements.navPanel.scrollTop = event.state?.navigationScrollTop || 0;
  scrollToRouteTarget(event.state?.documentScrollTop || 0);
  closeNavigation();
});
loadDocumentation();
