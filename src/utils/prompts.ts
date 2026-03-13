import inquirer from 'inquirer';

export async function promptFilePath(index: number, preview: string): Promise<{ filePath: string }> {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: `Enter file path for block ${index + 1} (preview: "${preview.slice(0, 50)}..."):`,
      validate: (input: string) => (input ? true : 'Path cannot be empty'),
    },
  ]);
}

export async function confirmApply(filePath: string): Promise<boolean> {
  const { ok } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'ok',
      message: `Apply changes to ${filePath}?`,
      default: false,
    },
  ]);
  return ok as boolean;
}

export async function confirmDeploy(providerName = 'Vercel'): Promise<boolean> {
  const { ok } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'ok',
      message: `Deploy to ${providerName} now?`,
      default: false,
    },
  ]);
  return ok as boolean;
}
